"use client";
import { useActionState } from "react";
import { changeEmail } from "@/app/actions";
import Link from "next/link";
import { REAUTH_MESSAGE } from "@/lib/auth-links";
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
export function EmailForm() {
  const [state, action, pending] = useActionState(changeEmail, null);
  return (
    <form action={action} className="form-stack" style={{ marginBottom: 40 }}>
      <label className="field">
        새 이메일
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
        />
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
