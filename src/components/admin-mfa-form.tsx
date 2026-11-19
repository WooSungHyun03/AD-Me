"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminMfaForm({
  factorId: initial,
}: {
  factorId: string | null;
}) {
  const [factorId, setFactorId] = useState(initial);
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function send(input: object) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error?.message || "인증을 처리하지 못했습니다.");
      if (data.factorId) {
        setFactorId(data.factorId);
        setSecret(data.secret);
      } else {
        setSecret("");
        router.replace("/admin");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "네트워크 오류입니다.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="panel form-stack">
      {!factorId && (
        <button
          className="button outline"
          disabled={pending}
          onClick={() => send({ action: "enroll" })}
        >
          OTP 등록 시작
        </button>
      )}
      {secret && (
        <div className="notice">
          <p>
            인증 앱에 아래 등록 키를 직접 입력한 뒤 6자리 OTP를 확인해주세요.
            등록 키는 비밀번호처럼 보관해주세요.
          </p>
          <code style={{ overflowWrap: "anywhere" }}>{secret}</code>
        </div>
      )}
      {factorId && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const code = new FormData(form).get("code");
            form.reset();
            await send({ action: "verify", factorId, code });
          }}
        >
          <label className="field">
            6자리 OTP
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              minLength={6}
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="button primary" disabled={pending}>
            {pending ? "인증 중…" : "OTP 확인"}
          </button>
        </form>
      )}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </div>
  );
}
