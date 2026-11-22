// D086: PII-free structured logs, error/limit alerts and resource usage vs free-plan limits. Server only.
import { randomUUID } from "node:crypto";

// Masks anything that identifies a person or grants access before it leaves the process.
const MASKS: [RegExp, string][] = [
  [/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
  [
    /\b(?:sb_secret|sb_publishable|test_sk|test_gsk|test_ck|live_sk|live_ck)_[A-Za-z0-9_-]+/g,
    "[key]",
  ],
  [/AIza[0-9A-Za-z_-]{35}/g, "[key]"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
  [/(?<!\d)01[016789][-\s]?\d{3,4}[-\s]?\d{4}(?!\d)/g, "[phone]"],
  [/\b\d{3}-\d{2}-\d{5}\b/g, "[bizno]"],
  [/\b(?:\d[ -]?){13,16}\b/g, "[card]"],
  [
    /([?&](?:token|code|access_token|refresh_token|paymentKey|key)=)[^&\s]+/gi,
    "$1[redacted]",
  ],
];
const SECRET_FIELDS =
  /pass(word)?|token|secret|authorization|cookie|api[-_]?key|email|phone|body|brief|reason/i;

export function mask(value: unknown, depth = 0): unknown {
  if (typeof value === "string")
    return MASKS.reduce((s, [re, to]) => s.replace(re, to), value).slice(
      0,
      500,
    );
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value))
    return value.slice(0, 20).map((v) => mask(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      SECRET_FIELDS.test(k) ? "[redacted]" : mask(v, depth + 1),
    ]),
  );
}

export function requestId(
  headers?: Headers | Record<string, string | string[] | undefined>,
) {
  const get = (k: string) =>
    headers instanceof Headers
      ? headers.get(k)
      : ([headers?.[k]].flat()[0] ?? null);
  const id = get("x-vercel-id") ?? get("x-request-id");
  return id && /^[\w:.-]{1,128}$/.test(id) ? id : randomUUID();
}

type Level = "info" | "warn" | "error";
export function log(
  level: Level,
  event: string,
  fields: Record<string, unknown> = {},
) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    event,
    ...(mask(fields) as object),
  });
  (level === "error"
    ? console.error
    : level === "warn"
      ? console.warn
      : console.log)(line);
  return line;
}

// Alerts go to ALERT_WEBHOOK_URL (server-only; Slack/Discord-compatible JSON {text}). The same key alerts at most
// once per window per server instance.
// shortcut: in-memory dedupe is per instance; move to a DB/KV table if alert storms appear across instances.
const sent = new Map<string, number>();
export const ALERT_WINDOW_MS = 10 * 60 * 1000;
export async function alert(
  key: string,
  text: string,
  now = Date.now(),
  fetchImpl: typeof fetch = fetch,
) {
  const url = process.env.ALERT_WEBHOOK_URL;
  log("warn", "alert", { key, text });
  if (
    !url ||
    (!url.startsWith("https://") &&
      !/^http:\/\/(127\.0\.0\.1|localhost):/.test(url))
  )
    return "not_configured";
  const last = sent.get(key);
  if (last && now - last < ALERT_WINDOW_MS) return "deduped";
  sent.set(key, now);
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `[AD Me ${process.env.SERVICE_MODE ?? "free_beta"}] ${mask(text)}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

// D063: daily error count per route for /admin (no message or user data). Never throws.
async function countError(route: string, kind: string) {
  try {
    const { storageAdmin } = await import("./uploads");
    await storageAdmin()?.rpc("record_error", {
      p_route: route.split("?")[0],
      p_kind: kind,
    });
  } catch {}
}
export async function reportError(
  err: unknown,
  ctx: Record<string, unknown> = {},
) {
  const message = err instanceof Error ? err.message : String(err);
  const digest =
    typeof err === "object" && err && "digest" in err
      ? String(err.digest)
      : undefined;
  // The client went away mid-stream (navigation, closed tab): not a server fault, so no count or alert.
  if (/destination stream errored|aborted/i.test(message)) {
    log("warn", "client_aborted", { digest, ...ctx });
    return "ignored";
  }
  log("error", "server_error", { message, digest, ...ctx });
  await countError(String(ctx.route ?? "/other"), String(ctx.kind ?? "server"));
  return alert(
    `error:${ctx.route ?? "unknown"}:${digest ?? message.slice(0, 60)}`,
    `서버 오류 ${ctx.route ?? ""} ${digest ?? message}`,
  );
}

// Free-plan reference limits — verify against the provider console/pricing page before relying on them.
export const FREE_LIMITS = {
  db_bytes: { limit: 500 * 1024 ** 2, label: "Supabase DB 500MB" },
  storage_bytes: { limit: 1024 ** 3, label: "Supabase Storage 1GB" },
  active_users_30d: {
    limit: 50000,
    label: "Supabase Auth 월간 활성 사용자 50,000",
  },
} as const;
export const WARN_RATIO = 0.8;
export function usage(stats: Record<string, unknown>) {
  return Object.entries(FREE_LIMITS).map(([k, { limit, label }]) => {
    const used = Number(stats[k] ?? 0);
    const ratio = used / limit;
    return {
      key: k,
      label,
      used,
      limit,
      ratio: Math.round(ratio * 1000) / 1000,
      warn: ratio >= WARN_RATIO,
    };
  });
}
