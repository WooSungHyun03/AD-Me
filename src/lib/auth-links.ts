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

export const signupEmailAcknowledgement =
  "이 주소에서 이메일 인증이 필요하면 안내 메일을 보냅니다. 받은편지함과 스팸함을 확인해주세요.";

export function isPrivateSignupResult(code: string | undefined) {
  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    code === "user_not_found"
  );
}
