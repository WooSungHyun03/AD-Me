"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function ProposalForm({
  campaignId,
  creators,
  kind = "proposal",
}: {
  campaignId: string;
  creators: { id: string; name: string }[];
  kind?: "proposal" | "application";
}) {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        setPending(true);
        try {
          const res = await fetch("/api/proposals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              campaignId,
              creatorId: form.get("creatorId"),
              brief: form.get("brief"),
              kind,
            }),
          });
          const d = await res.json();
          setMessage(
            res.ok
              ? "전송되었습니다. 워크스페이스에서 진행 상황을 확인하세요."
              : d.error?.message || "전송 실패",
          );
        } catch {
          setMessage("네트워크 연결을 확인해주세요.");
        } finally {
          setPending(false);
        }
      }}
    >
      <label className="field">
        {kind === "proposal" ? "협업을 제안할 크리에이터" : "지원할 내 프로필"}
        <select
          aria-label={
            kind === "proposal"
              ? "협업을 제안할 크리에이터"
              : "지원할 내 프로필"
          }
          name="creatorId"
          required
        >
          {creators.map((c) => (
            <option value={c.id} key={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        {kind === "proposal" ? "협업 제안 메시지" : "지원 메시지"}
        <textarea
          name="brief"
          required
          minLength={10}
          maxLength={3000}
          placeholder="제품과 협업 일정, 전달하고 싶은 이야기를 작성해주세요."
        />
      </label>
      <Button disabled={pending || !creators.length}>
        {pending
          ? "전송 중…"
          : kind === "proposal"
            ? "협업 제안 전송"
            : "캠페인 지원"}
      </Button>
      {!creators.length && (
        <p className="notice">
          연결된 실제 크리에이터 계정이 없습니다. 가상 프로필에 메시지를
          발송하지 않습니다.
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
