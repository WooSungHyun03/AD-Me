"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function Moderate({
  id,
  kind,
  restricted,
}: {
  id: string;
  kind: "creator" | "campaign";
  restricted: boolean;
}) {
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return (
    <>
      <label className="field">
        운영 조치 사유
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          minLength={5}
          maxLength={500}
          required
        />
      </label>
      <button
        className="button outline small"
        disabled={pending || reason.trim().length < 5}
        onClick={async () => {
          setPending(true);
          try {
            const res = await fetch("/api/admin/moderate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, kind, published: restricted, reason }),
            });
            setMessage(res.ok ? "처리했습니다." : "처리하지 못했습니다.");
            if (res.ok) router.refresh();
          } catch {
            setMessage("네트워크 오류입니다.");
          } finally {
            setPending(false);
          }
        }}
      >
        {restricted ? "운영 잠금 해제" : "운영 비공개 잠금"}
      </button>
      <span role="status">{message}</span>
    </>
  );
}
