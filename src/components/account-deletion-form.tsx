"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
const stateSchema = z.object({
  id: z.uuid(),
  state: z.enum([
    "quarantining",
    "waiting_retention",
    "waiting_review",
    "retry_required",
    "erasing",
    "erased",
  ]),
  authRestricted: z.boolean(),
  storageRevoked: z.boolean(),
});
type Receipt = { id: string; receipt: string };
export function AccountDeletionForm({ enabled }: { enabled: boolean }) {
  const errorFocus = useRef<HTMLParagraphElement>(null);
  const receipt = useRef<Receipt | null>(null),
    [state, setState] = useState<z.infer<typeof stateSchema> | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (error) errorFocus.current?.focus();
  }, [error]);
  async function call(path: string, body: unknown) {
    const r = await fetch("/api/account/deletion" + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      data = await r.json();
    if (!r.ok)
      throw Error(data.error?.message ?? "접수 상태를 확인하지 못했습니다.");
    const parsed = stateSchema.parse(data);
    if (parsed.id !== receipt.current?.id)
      throw Error("접수 정보를 확인하지 못했습니다.");
    setState(parsed);
  }
  async function progress() {
    setPending(true);
    setError("");
    try {
      await call("/process", receipt.current);
    } catch (e) {
      setError(e instanceof Error ? e.message : "다시 확인해주세요.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel" style={{ marginTop: 32 }} aria-busy={pending}>
      <h2>계정 삭제 요청</h2>
      <p>
        프로필 비공개와 계정·파일 전체 파기는 다릅니다. 요청이 접수되면 계정
        접근을 제한하고 원본 파일 경로를 비공개 보관 위치로 전환합니다. 보존
        근거·기간·예외 검토가 끝날 때까지 영구 파기는 대기합니다. 이미
        내려받거나 캐시된 사본까지 즉시 회수할 수는 없습니다.
      </p>
      {!enabled && !state ? (
        <p>
          온라인 삭제 요청은 운영 검토 중입니다.{" "}
          <a href="mailto:2242798@donga.ac.kr">운영자에게 권리 요청 접수</a>를
          이용해주세요.
        </p>
      ) : null}
      {enabled && !state ? (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            const form = e.currentTarget,
              f = new FormData(form);
            receipt.current ??= {
              id: crypto.randomUUID(),
              receipt: Array.from(
                crypto.getRandomValues(new Uint8Array(32)),
                (b) => b.toString(16).padStart(2, "0"),
              ).join(""),
            };
            try {
              await call("", {
                ...receipt.current,
                password: String(f.get("password") ?? ""),
                ...(f.get("code") ? { code: String(f.get("code")) } : {}),
                confirmation: String(f.get("confirmation") ?? ""),
              });
              form.reset();
              await call("/process", receipt.current);
            } catch (e) {
              // A lost acknowledgement may have already restricted this session.
              try {
                await call("/status", receipt.current);
              } catch {
                setError(
                  e instanceof Error
                    ? e.message
                    : "접수 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
                );
              }
            } finally {
              setPending(false);
            }
          }}
        >
          <label className="field">
            현재 비밀번호
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label className="field">
            인증 앱 코드 (등록한 경우)
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
            />
          </label>
          <label className="field">
            확인 문구: 계정 삭제 요청
            <input
              name="confirmation"
              required
              autoComplete="off"
              placeholder="계정 삭제 요청"
            />
          </label>
          <label className="inline">
            <input type="checkbox" required />
            접수 즉시 서비스 접근이 제한되고 영구 파기는 보존 검토 후 처리됨을
            확인했습니다.
          </label>
          <button className="button outline" disabled={pending}>
            {pending ? "접수 중…" : "재인증 후 삭제 요청 접수"}
          </button>
        </form>
      ) : null}
      {state ? (
        <div>
          <p role="status">
            {state.state === "waiting_retention"
              ? "접근 제한·파일 격리를 확인했습니다. 보존 정책 검토 대기이며 계정·파일 영구 파기는 완료되지 않았습니다."
              : state.state === "waiting_review"
                ? "저장 항목의 추가 운영 검토가 필요합니다. 영구 파기는 대기 중입니다."
                : state.state === "erased"
                  ? "승인된 범위의 처리 완료 기록입니다."
                  : "삭제 요청이 접수되었습니다. 로그인 제한과 파일 격리 상태를 확인해주세요."}
          </p>
          <p>접수 번호: {state.id}</p>
          <p>
            로그인 제한: {state.authRestricted ? "확인" : "처리 중"} · 원본 파일
            경로 제거: {state.storageRevoked ? "확인" : "처리 중"}
          </p>
          <p>
            이 화면을 닫아도 DB 접수 기록은 유지됩니다. 상태 확인 비밀값은
            주소·로그에 넣지 않으며 이 화면 메모리에만 보관합니다. 화면을 잃으면
            운영자에게 접수 번호로 문의해주세요.
          </p>
          <button
            className="button outline"
            disabled={
              pending ||
              ["waiting_retention", "waiting_review", "erased"].includes(
                state.state,
              )
            }
            onClick={() => void progress()}
          >
            격리 처리 계속
          </button>{" "}
          <button
            className="button outline"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError("");
              try {
                await call("/status", receipt.current);
              } catch {
                setError("접수 상태를 확인하지 못했습니다.");
              } finally {
                setPending(false);
              }
            }}
          >
            접수 상태 확인
          </button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="error" ref={errorFocus} tabIndex={-1}>
          {error}
        </p>
      ) : null}
    </section>
  );
}
