"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function ClaimButton({ creatorId }: { creatorId: string }) {
  const [result, setResult] = useState<{
    code?: string;
    expiresAt?: string;
    error?: string;
  }>({});
  return (
    <div style={{ marginTop: 12 }}>
      <button
        className="button outline"
        onClick={async () => {
          try {
            const res = await fetch("/api/claims", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creatorId }),
            });
            const d = await res.json();
            setResult(
              res.ok
                ? d
                : { error: d.error?.message ?? "청구하지 못했습니다." },
            );
          } catch {
            setResult({ error: "네트워크 오류입니다." });
          }
        }}
      >
        내 프로필입니다 · 소유 확인 요청
      </button>
      {result.error && (
        <p role="alert" className="error">
          {result.error}
        </p>
      )}
      {result.code && (
        <p role="status">
          확인 코드 <strong>{result.code}</strong>를 해당 채널 소개란에 잠시
          추가해주세요. 운영자가 확인 후 연결합니다. 코드는 지금 한 번만
          표시되며 {new Date(result.expiresAt!).toLocaleString("ko-KR")}까지
          유효합니다.
        </p>
      )}
    </div>
  );
}
export function ClaimReview({ claimId }: { claimId: string }) {
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const router = useRouter();
  const send = async (approve: boolean) => {
    try {
      const res = await fetch("/api/claims", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, approve, code }),
      });
      const d = await res.json();
      setMessage(res.ok ? `처리: ${d.status}` : d.error?.message);
      if (res.ok) router.refresh();
    } catch {
      setMessage("네트워크 오류입니다.");
    }
  };
  return (
    <span className="inline">
      <label className="field">
        채널에서 확인한 코드
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="ADME-…"
          maxLength={40}
        />
      </label>
      <button
        className="button outline small"
        disabled={!code}
        onClick={() => send(true)}
      >
        소유 확인 승인
      </button>
      <button className="button outline small" onClick={() => send(false)}>
        거절
      </button>
      <span role="status">{message}</span>
    </span>
  );
}
