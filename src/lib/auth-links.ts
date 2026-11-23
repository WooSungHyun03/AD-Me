import { z } from "zod";
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
export const emailProofSchema = z.object({
  token_hash: z.string().regex(/^[A-Za-z0-9_-]{20,512}$/),
  type: z.enum(["email", "recovery", "email_change"]),
});

export const resetPasswordSchema = emailProofSchema
  .extend({
    type: z.literal("recovery"),
    password: z.string().min(10).max(128),
    confirm_password: z.string().min(10).max(128),
  })
  .refine((value) => value.password === value.confirm_password, {
    path: ["confirm_password"],
    message: "비밀번호가 일치하지 않습니다.",
  });

export const signupEmailAcknowledgement =
  "이 주소에서 이메일 인증이 필요하면 안내 메일을 보냅니다. 받은편지함과 스팸함을 확인해주세요.";

export function isPrivateSignupResult(code: string | undefined) {
  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "user_not_found"
  );
}

export function authSiteOrigin(value = process.env.NEXT_PUBLIC_APP_URL) {
  const origin = new URL(value || "https://be-celeb.org");
  const local =
    origin.hostname === "localhost" || origin.hostname === "127.0.0.1";
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    (origin.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        local &&
        origin.protocol === "http:"
      ))
  ) {
    throw new Error("인증 서비스 주소 설정을 확인해주세요.");
  }
  return origin.origin;
}

// Email links can never supply an arbitrary redirect destination.
