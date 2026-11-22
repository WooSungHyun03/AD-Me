"use client";
import { useState } from "react";
import { REASONS, type Verdict } from "@/lib/matching-eval";
export function MatchFeedback({
  campaignId,
  creatorId,
  name,
  current,
}: {
  campaignId: string;
  creatorId: string;
  name: string;
  current?: { verdict: Verdict; reason: string };
}) {
  const [verdict, setVerdict] = useState<Verdict>(current?.verdict ?? "fit");
  const [reason, setReason] = useState(current?.reason ?? "");
  const [message, setMessage] = useState(
    current
      ? `평가됨: ${(REASONS[current.verdict] as Record<string, string>)[current.reason]}`
      : "",
  );
  return (
    <form
      className="inline"
      style={{ fontSize: 13, marginTop: 8 }}
      aria-label={`${name} 추천 평가`}
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          const res = await fetch("/api/matching-feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignId, creatorId, verdict, reason }),
          });
          const d = await res.json();
          setMessage(res.ok ? "평가를 저장했습니다." : d.error?.message);
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <select
        aria-label="적합 여부"
        value={verdict}
        onChange={(e) => {
          setVerdict(e.target.value as Verdict);
          setReason("");
        }}
      >
        <option value="fit">적합</option>
        <option value="unfit">부적합</option>
      </select>
      <select
        aria-label="사유"
        value={reason}
        required
        onChange={(e) => setReason(e.target.value)}
      >
        <option value="">사유 선택</option>
        {Object.entries(REASONS[verdict]).map(([k, label]) => (
          <option key={k} value={k}>
            {label}
          </option>
        ))}
      </select>
      <button className="button outline small">평가 저장</button>
      <span role="status">{message}</span>
    </form>
  );
}
