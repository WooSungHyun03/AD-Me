"use client";
import { useActionState } from "react";
import { authAction } from "@/app/actions";
import { Button } from "./ui/button";
export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [state, action, pending] = useActionState(authAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="mode" value={mode} />
      <label className="field">
        이름
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          defaultValue={mode === "login" ? "로그인" : undefined}
        />
      </label>
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
      <label className="field">
        이용 역할
        <select name="role">
          <option value="brand">브랜드</option>
          <option value="creator">크리에이터</option>
        </select>
      </label>
      {state?.error && (
        <p role="alert" className="error">
          {state.error}
        </p>
      )}
      {state?.message && <p role="status">{state.message}</p>}
      <Button disabled={pending}>
        {pending ? "처리 중…" : mode === "signup" ? "계정 만들기" : "로그인"}
      </Button>
      {mode === "signup" && (
        <p style={{ fontSize: 12 }}>
          가입 시 서비스의 시연 데이터 정책과 개인정보 처리방침을 확인해주세요.
          관리자 권한은 운영자가 별도 부여합니다.
        </p>
      )}
    </form>
  );
}
