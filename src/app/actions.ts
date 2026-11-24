"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { reserveRequestBudget } from "@/lib/request-budget";
import {
  consentFieldsSchema,
  readCurrentPolicy,
  signupConsentMetadata,
} from "@/lib/consent";
import {
  REAUTH_MESSAGE,
  authSiteOrigin,
  safeNext,
  isPrivateSignupResult,
  signupEmailAcknowledgement,
} from "@/lib/auth-links";
import { hasRecentSessionSignIn } from "@/lib/session-reauth";
export async function authAction(_: unknown, form: FormData) {
  if (!configured())
    return {
      error:
        "계정 서비스 연결 준비 중입니다. Supabase 연결 후 가입·로그인을 이용할 수 있습니다.",
    };
  const parsed = z
    .object({
      email: z.email(),
      password: z.string().min(10),
      role: z.enum(["brand", "creator"]),
      name: z.string().min(2).max(80),
      mode: z.enum(["login", "signup"]),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "이름, 이메일과 10자 이상의 비밀번호를 확인해주세요." };
  const d = parsed.data;
  const { appOrigin, features } = getConfig();
  if (d.mode === "signup" && features.mail !== "enabled")
    return { error: "가입 메일 서비스 연결을 준비 중입니다." };
  const db = await supabase();
  if (d.mode === "signup") {
    if (!consentFieldsSchema.safeParse(Object.fromEntries(form)).success)
      return {
        error: "이용약관·개인정보 안내와 성인 베타 확인을 각각 선택해주세요.",
      };
    try {
      if (!(await readCurrentPolicy(db)).approved)
        return { error: "정책 검토가 완료된 뒤 가입할 수 있습니다." };
    } catch {
      return {
        error: "정책 정보를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.",
      };
    }
  }
  const budget = await reserveRequestBudget(d.mode, d.email);
  if (budget) return { error: budget };
  const result =
    d.mode === "signup"
      ? await db.auth.signUp({
          email: d.email,
          password: d.password,
          options: {
            data: { role: d.role, name: d.name, ...signupConsentMetadata },
            emailRedirectTo: `${appOrigin}/auth/confirm`,
          },
        })
      : await db.auth.signInWithPassword({
          email: d.email,
          password: d.password,
        });
  if (d.mode === "signup" && isPrivateSignupResult(result.error?.code))
    return { message: signupEmailAcknowledgement };
  if (
    result.error &&
    d.mode === "signup" &&
    [
      "email_address_not_authorized",
      "email_address_invalid",
      "over_email_send_rate_limit",
      "unexpected_failure",
    ].includes(result.error.code ?? "")
  )
    return {
      error:
        "인증 메일을 발송하지 못했습니다. 잠시 후 다시 시도하거나 지원 이메일로 문의해주세요.",
    };
  if (result.error)
    return {
      error:
        d.mode === "signup"
          ? "가입을 처리하지 못했습니다. 이메일과 비밀번호를 확인해주세요."
          : "이메일 또는 비밀번호를 확인해주세요.",
    };
  if (d.mode === "signup") {
    if (result.data.session) {
      await db.auth.signOut({ scope: "local" });
      return {
        error: "가입 인증 설정을 확인 중입니다. 운영자에게 문의해주세요.",
      };
    }
    return { message: signupEmailAcknowledgement };
  }
  redirect(safeNext(form.get("next")?.toString()));
}
export async function logout() {
  const db = await supabase();
  const result = await db.auth
    .signOut({ scope: "global" })
    .catch(() => ({ error: true }));
  if (result.error) redirect("/login?error=logout");
  redirect("/");
}

type FormState = { error?: string; message?: string } | null;
export async function changeEmail(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "새 이메일 주소를 확인해주세요." };
  if (!configured()) return { error: "계정 서비스 연결 준비 중입니다." };
  if (getConfig().features.mail !== "enabled")
    return { error: "이메일 변경 서비스 연결을 준비 중입니다." };
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "다시 로그인해주세요." };
  const { data: verified, error: claimsError } = await db.auth.getClaims();
  if (claimsError || !hasRecentSessionSignIn(verified?.claims, user.id))
    return { error: REAUTH_MESSAGE };
  if (email.data.toLowerCase() === user.email?.toLowerCase())
    return { error: "현재 이메일과 같습니다." };
  const { error } = await db.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: `${authSiteOrigin()}/auth/confirm` },
  );
  if (error)
    return {
      error: "이메일 변경을 요청하지 못했습니다. 잠시 후 다시 시도해주세요.",
    };
  return {
    message:
      "확인 메일을 보냈습니다. 메일의 링크로 확인을 마치기 전까지는 기존 이메일로 로그인합니다.",
  };
}
