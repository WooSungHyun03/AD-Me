"use client";
import { useActionState } from "react";
import {
  changeEmail,
  requestPasswordReset,
  updatePassword,
} from "@/app/actions";
import Link from "next/link";
import { REAUTH_MESSAGE } from "@/lib/auth-links";
import { Button } from "./ui/button";
function Result({
  state,
}: {
  state: { error?: string; message?: string } | null;
}) {
  if (state?.error)
    return (
      <p role="alert" className="error">
        {state.error}
      </p>
    );
  return state?.message ? <p role="status">{state.message}</p> : null;
}
export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <form action={action}>
      <label className="field">
        가입한 이메일
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <Result state={state} />
      <Button disabled={pending}>
        {pending ? "처리 중…" : "재설정 링크 받기"}
      </Button>
    </form>
  );
}
export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, null);
  return (
    <form action={action}>
      <label className="field">
        새 비밀번호
        <input
          name="password"
          type="password"
          minLength={10}
          maxLength={72}
          required
          autoComplete="new-password"
        />
      </label>
      <label className="field">
        새 비밀번호 확인
        <input
          name="confirm"
          type="password"
          minLength={10}
          maxLength={72}
          required
          autoComplete="new-password"
        />
      </label>
      <Result state={state} />
      <Button disabled={pending}>
        {pending ? "처리 중…" : "비밀번호 변경"}
      </Button>
    </form>
  );
}
export function EmailForm() {
  const [state, action, pending] = useActionState(changeEmail, null);
  return (
    <form action={action} className="form-stack" style={{ marginBottom: 40 }}>
      <label className="field">
        새 이메일
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <button className="button outline" disabled={pending}>
        {pending ? "처리 중…" : "이메일 변경 요청"}
      </button>
      <Result state={state} />
      {state?.error === REAUTH_MESSAGE && (
        <Link href="/login?next=/settings&reauth=1">다시 로그인하기 →</Link>
      )}
    </form>
  );
}
