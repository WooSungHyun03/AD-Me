"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
export function DealControls({
  id,
  actions,
  status = "pending",
}: {
  id: string;
  actions: string[];
  status?: string;
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const sending = useRef(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
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
              if (sending.current) return;
              const signature = JSON.stringify({ id, action, status });
              if (retry.current?.signature !== signature)
                retry.current = { signature, key: crypto.randomUUID() };
              sending.current = true;
              setError("");
              setPending(true);
              try {
                const res = await fetch("/api/proposals", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id,
                    action,
                    ...(["accepted", "rejected", "cancelled"].includes(
                      action,
                    ) && status === "pending"
                      ? {
                          requestKey: retry.current.key,
                          expectedStatus: status,
                        }
                      : {}),
                  }),
                });
                const d = await res.json();
                if (!res.ok) setError(d.error?.message || "변경 실패");
                else router.refresh();
              } catch {
                setError(
                  "처리 결과를 확인하지 못했습니다. 같은 동작으로 다시 시도하거나 최신 상태를 확인해주세요.",
                );
              } finally {
                sending.current = false;
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
  onSent,
}: {
  proposalId: string;
  deliverable: boolean;
  onSent?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const router = useRouter();
  return (
    <form
      className="form-stack"
      style={{ marginTop: 20 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending.current) return;
        const f = new FormData(e.currentTarget);
        const form = e.currentTarget;
        const payload = {
          proposalId,
          body: f.get("body"),
          url: f.get("url") || undefined,
          kind: f.get("kind"),
        };
        const signature = JSON.stringify(payload);
        if (retry.current?.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        sending.current = true;
        setPending(true);
        try {
          const res = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, clientKey: retry.current.key }),
          });
          const d = await res.json();
          if (res.ok) {
            form.reset();
            retry.current = null;
            if (onSent) onSent();
            else router.refresh();
            setMessage("저장되었습니다.");
          } else setMessage(d.error?.message || "저장 실패");
        } catch {
          setMessage(
            "전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도하면 중복 저장되지 않습니다.",
          );
        } finally {
          sending.current = false;
          setPending(false);
        }
      }}
    >
      <label className="field">
        메시지
        <textarea name="body" required maxLength={3000} disabled={pending} />
      </label>
      <label className="field">
        종류
        <select aria-label="종류" name="kind" disabled={pending}>
          <option value="message">일반 메시지</option>
          {deliverable && <option value="deliverable">결과물 링크 제출</option>}
        </select>
      </label>
      {deliverable && (
        <label className="field">
          결과물 HTTPS 링크
          <input
            name="url"
            type="url"
            placeholder="https://"
            disabled={pending}
          />
        </label>
      )}
      <Button variant="outline" disabled={pending}>
        {pending ? "전송 중…" : "메시지 저장"}
      </Button>
      <p role="status">{message}</p>
    </form>
  );
}
export function ReadButton({
  proposalId,
  unread,
}: {
  proposalId: string;
  unread: number;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  if (!unread) return null;
  return (
    <>
      <button
        className="button ghost small"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setFailed(false);
          try {
            const res = await fetch("/api/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ proposalId }),
            });
            if (res.ok) router.refresh();
            else setFailed(true);
          } catch {
            setFailed(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "처리 중…" : `안 읽은 메시지 ${unread}개 · 읽음으로 표시`}
      </button>
      {failed && <p role="alert">읽음 상태를 저장하지 못했습니다.</p>}
    </>
  );
}
