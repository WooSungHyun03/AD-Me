// D023: TikTok Display API adapter — pure, gated pieces only. Nothing here runs until the policy entry
// `tiktok_display_api` is approved (U013) and DEV-A's ingestion storage (D018) exists; see
// docs/data-sources/tiktok-display-api.md. Research API / client-credential tokens are never requested.
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { assertSourceAllowed, policies, type SourcePolicy } from "./policy";
// Minimal scopes for the allowlisted fields (no user.info.profile: bio/links are not on the allowlist).
export const TIKTOK_SCOPES = [
  "user.info.basic",
  "user.info.stats",
  "video.list",
] as const;
export const TIKTOK_USER_FIELDS = [
  "open_id",
  "display_name",
  "avatar_url",
  "follower_count",
] as const;
export const ACCESS_TTL_S = 2 * 3600; // provider-documented: 2h access, 180d rotating refresh
export const REFRESH_TTL_S = 180 * 86400;
export class TikTokScopeError extends Error {}
export function authorizeUrl(
  o: { clientKey: string; redirectUri: string; state: string },
  table: Record<string, SourcePolicy> = policies,
) {
  assertSourceAllowed("tiktok_display_api", new Date(), table); // before any redirect or fetch
  const r = new URL(o.redirectUri);
  if (r.protocol !== "https:" || r.search || r.hash)
    throw new Error("redirect_uri must be static https");
  if (!/^[A-Za-z0-9_-]{32,}$/.test(o.state))
    throw new Error("state must be a random token");
  const u = new URL("https://www.tiktok.com/v2/auth/authorize/");
  u.search = new URLSearchParams({
    client_key: o.clientKey,
    response_type: "code",
    scope: TIKTOK_SCOPES.join(","),
    redirect_uri: o.redirectUri,
    state: o.state,
  }).toString();
  return u.toString();
}
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  open_id: z.string().min(1),
  scope: z.string(),
  expires_in: z.number().int().positive(),
  refresh_expires_in: z.number().int().positive(),
  token_type: z.literal("Bearer"),
});
// Validates a token response (initial or refresh). Missing scopes are an error the UI can explain; extra scopes
// outside the allowlist are refused so nothing broader than reviewed is ever held.
export function parseToken(raw: unknown, now = Date.now()) {
  const t = tokenSchema.parse(raw);
  const granted = t.scope
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const missing = TIKTOK_SCOPES.filter((s) => !granted.includes(s));
  if (missing.length)
    throw new TikTokScopeError(`missing_scope:${missing.join(",")}`);
  const extra = granted.filter(
    (s) => !(TIKTOK_SCOPES as readonly string[]).includes(s),
  );
  if (extra.length)
    throw new TikTokScopeError(`unexpected_scope:${extra.join(",")}`);
  return {
    openId: t.open_id,
    accessToken: t.access_token,
    refreshToken: t.refresh_token, // rotates: always persist the newest one, the previous is invalid
    accessExpiresAt: new Date(
      now + Math.min(t.expires_in, ACCESS_TTL_S) * 1000,
    ),
    refreshExpiresAt: new Date(
      now + Math.min(t.refresh_expires_in, REFRESH_TTL_S) * 1000,
    ),
    scopes: granted,
  };
}
// Webhook authenticity: TikTok-Signature "t=<unix>,s=<hex>" = HMAC-SHA256(client_secret, `${t}.${rawBody}`).
// shortcut: 300s tolerance is our choice (provider states none); tighten if replays are observed.
export function verifyWebhook(
  header: string | null,
  rawBody: string,
  secret: string,
  nowS = Math.floor(Date.now() / 1000),
  toleranceS = 300,
) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=", 2) as [string, string]),
  );
  const t = Number(parts.t);
  if (
    !Number.isInteger(t) ||
    !/^[0-9a-f]{64}$/i.test(parts.s ?? "") ||
    Math.abs(nowS - t) > toleranceS
  )
    return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest();
  return timingSafeEqual(expected, Buffer.from(parts.s, "hex"));
}
const deauthSchema = z.object({
  event: z.literal("authorization.removed"),
  user_openid: z.string().min(1),
  create_time: z.number().int(),
  content: z.string(),
});
// authorization.removed → the connection and every stored TikTok field for that open_id must be deleted
// (the provider has already revoked the token). Delivery is at-least-once, so deletion must be idempotent.
export function parseDeauthorization(body: unknown) {
  const e = deauthSchema.parse(body);
  const reason = z
    .object({ reason: z.number().int() })
    .safeParse(JSON.parse(e.content || "{}"));
  return {
    openId: e.user_openid,
    reason: reason.success ? reason.data.reason : 0,
    at: new Date(e.create_time * 1000),
  };
}
