"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { reserveRequestBudget } from "@/lib/request-budget";
import {
  emailProofSchema,
  isPrivateSignupResult,
  resetPasswordSchema,
  signupEmailAcknowledgement,
} from "@/lib/auth-links";

export type EmailActionState = { error?: string; message?: string };

export async function resendSignupEmail(
  _: EmailActionState,
  form: FormData,
): Promise<EmailActionState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "올바른 이메일 주소를 입력해주세요." };
  const { appOrigin, features } = getConfig();
  if (features.mail !== "enabled")
    return { error: "가입 메일 서비스 연결을 준비 중입니다." };
  const budget = await reserveRequestBudget("resend", email.data);
  if (budget) return { error: budget };
  const db = await supabase();
  const { error } = await db.auth.resend({
    type: "signup",
    email: email.data,
    options: { emailRedirectTo: `${appOrigin}/auth/confirm` },
  });
  if (error && !isPrivateSignupResult(error.code))
    return {
      error: "재발송 요청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  return { message: signupEmailAcknowledgement };
}

export async function requestRecovery(
  _: EmailActionState,
  form: FormData,
): Promise<EmailActionState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "올바른 이메일 주소를 입력해주세요." };
  const { appOrigin, features } = getConfig();
  if (features.mail !== "enabled")
    return { error: "계정 서비스 연결을 준비 중입니다." };
  const db = await supabase();
  const budget = await reserveRequestBudget("recovery", email.data);
  if (budget) return { error: budget };
  const { error } = await db.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${appOrigin}/auth/confirm`,
  });
  if (error)
    return {
      error:
        "메일 발송 요청을 완료하지 못했습니다. 잠시 후 다시 시도하거나 운영자에게 문의해주세요.",
    };
  return {
    message:
      "해당 주소로 복구 가능한 계정이 있다면 안내 메일을 보냅니다. 스팸함도 확인해주세요.",
  };
}

export async function confirmEmail(
  _: EmailActionState,
  form: FormData,
): Promise<EmailActionState> {
  const parsed = emailProofSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || parsed.data.type === "recovery")
    return { error: "올바른 인증 링크를 다시 열어주세요." };
  if (!configured()) return { error: "계정 서비스 연결을 준비 중입니다." };
  const db = await supabase();
  const { data, error } = await db.auth.verifyOtp(parsed.data);
  if (error)
    return {
      error:
        "인증 링크가 만료되었거나 이미 사용되었습니다. 새 안내 메일을 요청해주세요.",
    };
  if (parsed.data.type === "email_change") {
    if (!data?.user || !data.session)
      return {
        message:
          "한쪽 이메일 확인이 끝났습니다. 다른 주소로 받은 이메일의 확인도 완료해주세요.",
      };
    redirect("/settings");
  }
  redirect("/dashboard");
}

export async function resetPassword(
  _: EmailActionState,
  form: FormData,
): Promise<EmailActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "유효한 복구 링크와 일치하는 10~128자 비밀번호를 확인해주세요.",
    };
  if (!configured()) return { error: "계정 서비스 연결을 준비 중입니다." };
  const db = await supabase();
  // Redeem a real, one-use recovery proof on this POST. A logged-in session
  // alone, or a user-controlled query flag, cannot authorize a password reset.
  const { data, error } = await db.auth.verifyOtp({
    token_hash: parsed.data.token_hash,
    type: "recovery",
  });
  if (error || !data.user || !data.session)
    return {
      error:
        "복구 링크가 만료되었거나 이미 사용되었습니다. 새 복구 메일을 요청해주세요.",
    };
  const update = await db.auth.updateUser({ password: parsed.data.password });
  if (update.error) {
    await db.auth.signOut();
    return {
      error:
        "비밀번호를 변경하지 못했습니다. 다른 비밀번호로 새 복구 링크를 요청해주세요.",
    };
  }
  await db.auth.signOut({ scope: "global" });
  redirect("/login?password_reset=complete");
}
