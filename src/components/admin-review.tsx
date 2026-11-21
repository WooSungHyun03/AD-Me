"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminReview({
  id,
  onChanged,
}: {
  id: string;
  onChanged?: () => void;
}) {
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <div className="inline">
      <label className="field">
        신고 검토 사유
        <input
          value={reason}
          minLength={5}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          required
        />
      </label>
      {["reviewed", "dismissed"].map((status) => (
        <button
          className="button outline small"
          key={status}
          disabled={pending || reason.trim().length < 5}
          onClick={async () => {
            setPending(true);
            try {
              const res = await fetch("/api/admin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status, reason }),
              });
              if (res.ok) {
                router.refresh();
                onChanged?.();
              } else setMessage("처리 권한이 없거나 실패했습니다.");
            } catch {
              setMessage("네트워크 오류입니다. 다시 시도해주세요.");
            } finally {
              setPending(false);
            }
          }}
        >
          {status === "reviewed" ? "검토 완료" : "반려"}
        </button>
      ))}
      <span role="status">{message}</span>
    </div>
  );
}
