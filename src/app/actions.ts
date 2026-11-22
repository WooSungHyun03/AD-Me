"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import {
  REAUTH_MESSAGE,
  RECOVERY_COOKIE,
  appUrl,
  recentSignIn,
  safeNext,
} from "@/lib/auth-links";
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
      next: z.string().max(100).optional(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "이름, 이메일과 10자 이상의 비밀번호를 확인해주세요." };
  const db = await supabase();
  const d = parsed.data;
  const result =
    d.mode === "signup"
      ? await db.auth.signUp({
          email: d.email,
          password: d.password,
          options: { data: { role: d.role, name: d.name } },
        })
      : await db.auth.signInWithPassword({
          email: d.email,
          password: d.password,
        });
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
        "인증 메일 발송 서비스 설정이 필요합니다. 현재 시연 계정 로그인만 검증되었습니다. 운영자가 SMTP 연결을 준비 중입니다.",
    };
  if (result.error)
    return {
      error:
        d.mode === "signup"
          ? "가입을 처리하지 못했습니다. 이메일과 비밀번호를 확인해주세요."
          : "이메일 또는 비밀번호를 확인해주세요.",
    };
  if (d.mode === "signup" && !result.data.session)
    return {
      message: "가입 확인 이메일을 보냈습니다. 이메일 인증 후 로그인해주세요.",
    };
  redirect(safeNext(d.next));
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/");
}

type FormState = { error?: string; message?: string } | null;
const RESET_SENT =
  "입력한 주소로 가입된 계정이 있으면 재설정 링크를 보냈습니다. 링크는 한 번만, 짧은 시간 동안 사용할 수 있습니다.";
export async function requestPasswordReset(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const email = z.email().safeParse(form.get("email"));
  if (!email.success) return { error: "이메일 주소를 확인해주세요." };
  if (!configured()) return { error: "계정 서비스 연결 준비 중입니다." };
  const db = await supabase();
  // Same answer whether or not the account exists (no account enumeration).
  await db.auth
    .resetPasswordForEmail(email.data, {
      redirectTo: `${appUrl()}/auth/confirm?next=/auth/reset`,
    })
    .catch(() => null);
  return { message: RESET_SENT };
}
export async function updatePassword(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const p = z
    .object({ password: z.string().min(10).max(72), confirm: z.string() })
    .refine((v) => v.password === v.confirm)
    .safeParse(Object.fromEntries(form));
  if (!p.success)
    return { error: "10~72자 비밀번호를 같은 값으로 두 번 입력해주세요." };
  if (!configured()) return { error: "계정 서비스 연결 준비 중입니다." };
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  const jar = await cookies();
  // Only the account whose recovery link was just verified, within the TTL.
  if (!user || jar.get(RECOVERY_COOKIE)?.value !== user.id)
    return {
      error: "재설정 링크가 만료되었거나 다른 계정입니다. 다시 요청해주세요.",
    };
  const { error } = await db.auth.updateUser({ password: p.data.password });
  if (error)
    return {
      error:
        "새 비밀번호를 적용하지 못했습니다. 이전과 다른 값을 사용해주세요.",
    };
  jar.delete(RECOVERY_COOKIE);
  await db.auth.signOut({ scope: "others" });
  redirect("/dashboard");
}
export async function changeEmail(
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "새 이메일 주소를 확인해주세요." };
  if (!configured()) return { error: "계정 서비스 연결 준비 중입니다." };
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "다시 로그인해주세요." };
  if (!recentSignIn(user)) return { error: REAUTH_MESSAGE };
  if (email.data.toLowerCase() === user.email?.toLowerCase())
    return { error: "현재 이메일과 같습니다." };
  const { error } = await db.auth.updateUser(
    { email: email.data },
    { emailRedirectTo: `${appUrl()}/auth/confirm?next=/settings` },
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
