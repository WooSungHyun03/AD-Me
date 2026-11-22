"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function DealControls({
  id,
  actions,
}: {
  id: string;
  actions: string[];
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const labels: Record<string, string> = {
    accepted: "수락",
    rejected: "거절",
    cancelled: "요청 취소",
    submitted: "결과물 제출 완료",
    completed: "검토 승인",
    revision_requested: "수정 요청",
  };
  return (
    <>
      <div className="inline">
        {actions.map((action) => (
          <Button
            key={action}
            disabled={pending}
            variant={
              ["rejected", "cancelled"].includes(action) ? "outline" : "default"
            }
            onClick={async () => {
              setPending(true);
              try {
                const res = await fetch("/api/proposals", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id, action }),
                });
                const d = await res.json();
                if (!res.ok) setError(d.error?.message || "변경 실패");
                else router.refresh();
              } catch {
                setError("네트워크 오류입니다.");
              } finally {
                setPending(false);
              }
            }}
          >
            {labels[action]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
export function MessageForm({
  proposalId,
  deliverable,
}: {
  proposalId: string;
  deliverable: boolean;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="form-stack"
      style={{ marginTop: 20 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        try {
          const res = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              proposalId,
              body: f.get("body"),
              url: f.get("url") || undefined,
              kind: f.get("kind"),
            }),
          });
          const d = await res.json();
          if (res.ok) {
            form.reset();
            router.refresh();
            setMessage("저장되었습니다.");
          } else setMessage(d.error?.message || "저장 실패");
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <label className="field">
        메시지
        <textarea name="body" required maxLength={3000} />
      </label>
      <label className="field">
        종류
        <select aria-label="종류" name="kind">
          <option value="message">일반 메시지</option>
          {deliverable && <option value="deliverable">결과물 링크 제출</option>}
        </select>
      </label>
      {deliverable && (
        <label className="field">
          결과물 HTTPS 링크
          <input name="url" type="url" placeholder="https://" />
        </label>
      )}
      <Button variant="outline">메시지 저장</Button>
      <p role="status">{message}</p>
    </form>
  );
}
