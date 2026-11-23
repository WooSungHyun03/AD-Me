// D086: health checks shared by /api/health (admin details) and the admin page.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { alert, usage } from "./observability";
import { getConfig } from "./config";

// Public probe: one tiny anonymous read. No details leave this function except ok/latency.
export async function probe() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    return { ok: false, ms: 0, reason: "not_configured" as const };
  const started = Date.now();
  try {
    const db = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await db
      .from("products")
      .select("sku")
      .limit(1)
      .abortSignal(AbortSignal.timeout(4000));
    return {
      ok: !error,
      ms: Date.now() - started,
      reason: error ? ("db_error" as const) : undefined,
    };
  } catch {
    return {
      ok: false,
      ms: Date.now() - started,
      reason: "unreachable" as const,
    };
  }
}

export async function details(db: SupabaseClient) {
  const config = getConfig();
  const p = await probe();
  if (!p.ok) await alert(`health:${p.reason}`, `헬스체크 실패: ${p.reason}`);
  const { data: stats, error } = await db.rpc("ops_stats");
  const u = stats ? usage(stats) : [];
  for (const x of u.filter((x) => x.warn))
    await alert(
      `limit:${x.key}`,
      `무료 한도 ${Math.round(x.ratio * 100)}% 도달: ${x.label}`,
    );
  return {
    status: p.ok ? "ok" : "down",
    db: p,
    mode: config.serviceMode,
    diagnostics: config.diagnostics,
    region: process.env.VERCEL_REGION ?? "local",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    // Configured or not — never the values.
    configured: {
      service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      toss_test_client: (
        process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""
      ).startsWith("test_"),
      youtube: Boolean(process.env.YOUTUBE_API_KEY),
      alert_webhook: Boolean(process.env.ALERT_WEBHOOK_URL),
    },
    stats: error ? null : stats,
    usage: u,
  };
}
