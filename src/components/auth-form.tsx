"use client";
import { useActionState, useEffect, useId, useRef } from "react";
import Link from "next/link";
import type { PolicyStatus } from "@/lib/consent";
import { authAction } from "@/app/actions";
import { Button } from "./ui/button";
export function AuthForm({
  mode,
  policy,
  next,
}: {
  mode: "login" | "signup";
  policy?: PolicyStatus;
  next?: string;
}) {
  const [state, action, pending] = useActionState(authAction, null);
  const statusId = useId(),
    errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state?.error) errorRef.current?.focus();
  }, [state]);
  return (
    <form
      action={action}
      aria-busy={pending}
      aria-describedby={state?.error || state?.message ? statusId : undefined}
    >
      {next && <input type="hidden" name="next" value={next} />}
      <input type="hidden" name="mode" value={mode} />
      {mode === "login" ? (
        <input type="hidden" name="name" value="로그인" />
      ) : (
        <label className="field">
          이름
          <input
            name="name"
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
          />
        </label>
      )}
      <label className="field">
        이메일
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className="field">
        비밀번호
        <input
          name="password"
          type="password"
          minLength={10}
          required
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </label>
      {mode === "login" ? (
        <input type="hidden" name="role" value="brand" />
      ) : (
        <label className="field">
          이용 역할
          <select name="role">
            <option value="brand">브랜드</option>
            <option value="creator">크리에이터</option>
          </select>
        </label>
      )}
      {mode === "signup" && policy && (
        <fieldset className="consent-fields">
          <legend>가입에 필요한 확인 · {policy.version}</legend>
          <input type="hidden" name="policyVersion" value={policy.version} />
          <input type="hidden" name="policyHash" value={policy.documentHash} />
          <label>
            <input type="checkbox" name="termsAccepted" required /> 이용약관에
            동의합니다 (필수){" "}
            <Link href="/terms" target="_blank" rel="noopener noreferrer">
              약관 읽기 ↗
            </Link>
          </label>
          <label>
            <input type="checkbox" name="privacyAccepted" required /> 개인정보
            처리 안내를 확인했습니다 (필수){" "}
            <Link href="/privacy" target="_blank" rel="noopener noreferrer">
              처리 안내 읽기 ↗
            </Link>
          </label>
          <label>
            <input type="checkbox" name="adultConfirmed" required /> 만 19세
            이상 성인임을 확인합니다 (필수)
          </label>
          <p>
            프로필·SNS 링크 공개는 가입과 별개의 선택이며 설정에서 철회할 수
            있습니다. 필수 확인은 미리 선택하지 않습니다.
          </p>
        </fieldset>
      )}
      {state?.error && (
        <p
          role="alert"
          className="error"
          id={statusId}
          ref={errorRef}
          tabIndex={-1}
        >
          {state.error}
        </p>
      )}
      {state?.message && (
        <p role="status" id={statusId}>
          {state.message}
        </p>
      )}
      <Button disabled={pending}>
        {pending ? "처리 중…" : mode === "signup" ? "계정 만들기" : "로그인"}
      </Button>
      {mode === "signup" && (
        <p style={{ fontSize: 12 }}>
          관리자 권한은 운영자가 별도 부여합니다. 이메일 인증이 끝나기 전에는
          계정을 사용할 수 없습니다.
        </p>
      )}
    </form>
  );
}
