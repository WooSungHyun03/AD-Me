"use client";

import { useActionState } from "react";
import {
  confirmEmail,
  requestRecovery,
  resetPassword,
  type EmailActionState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";

export function EmailActionForm({
  mode,
  tokenHash = "",
  proofType = "email",
}: {
  mode: "request" | "confirm" | "reset";
  tokenHash?: string;
  proofType?: "email" | "recovery" | "email_change";
}) {
  const action =
    mode === "request"
      ? requestRecovery
      : mode === "reset"
        ? resetPassword
        : confirmEmail;
  const [state, formAction, pending] = useActionState<
    EmailActionState,
    FormData
  >(action, {});
  return (
    <form action={formAction} className="form" aria-busy={pending}>
      {mode === "request" ? (
        <label>
          이메일
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            maxLength={254}
          />
        </label>
      ) : (
        <>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input
            type="hidden"
            name="type"
            value={mode === "reset" ? "recovery" : proofType}
          />
        </>
      )}
      {mode === "reset" && (
        <>
          <label>
            새 비밀번호
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              type="password"
              name="confirm_password"
              autoComplete="new-password"
              minLength={10}
              maxLength={128}
              required
            />
          </label>
        </>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      {state.message && <p role="status">{state.message}</p>}
      <Button disabled={pending}>
        {pending
          ? "처리 중…"
          : mode === "request"
            ? "복구 메일 요청"
            : mode === "reset"
              ? "비밀번호 변경"
              : "이메일 인증 완료하기"}
      </Button>
    </form>
  );
}
