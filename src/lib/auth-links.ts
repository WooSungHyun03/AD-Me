// Auth email links must never be built from the request Host header (host-header poisoning of reset mails).
export function appUrl(env: Record<string, string | undefined> = process.env) {
  const raw =
    env.NEXT_PUBLIC_APP_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL &&
      `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  if (!raw) throw new Error("NEXT_PUBLIC_APP_URL 설정이 필요합니다.");
  return new URL(raw).origin;
}
const allowedNext = [
  "/auth/reset",
  "/settings",
  "/dashboard",
  "/campaigns/new",
  "/admin",
  "/reports",
];
// Only fixed same-origin paths: rejects //evil.com, /\evil.com, absolute URLs and unknown paths.
// Plus the per-profile request form, with a strictly shaped query (D032: keeps the profile across sign-in).
const REQUEST_NEXT =
  /^\/reports\/new\?creator=[A-Za-z0-9_-]{1,80}(&kind=(correction|deletion|report|impersonation))?$/;
export const safeNext = (next: string | null | undefined) =>
  allowedNext.includes(next ?? "") || REQUEST_NEXT.test(next ?? "")
    ? next!
    : "/dashboard";
export const RECOVERY_COOKIE = "adme_recovery";
export const RECOVERY_TTL_SECONDS = 600;
// Sensitive actions (email change, profile deletion) need a fresh sign-in, not just a refreshed token.
// last_sign_in_at moves on password/OTP sign-in only, never on silent token refresh.
export const REAUTH_SECONDS = 600;
export const recentSignIn = (
  user: { last_sign_in_at?: string | null } | null,
  now = Date.now(),
) =>
  Boolean(user?.last_sign_in_at) &&
  now - Date.parse(user!.last_sign_in_at!) < REAUTH_SECONDS * 1000;
export const REAUTH_MESSAGE =
  "보안을 위해 다시 로그인한 뒤 10분 안에 진행해주세요.";
