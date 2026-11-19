import { z } from "zod";

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
export function authNextPath(value: string | null) {
  return value === "/dashboard" ? value : "/dashboard";
}
