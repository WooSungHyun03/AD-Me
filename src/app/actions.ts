"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
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
  redirect("/dashboard");
}
export async function logout() {
  const db = await supabase();
  await db.auth.signOut();
  redirect("/");
}
