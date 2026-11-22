"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
// D068: one idempotency key per mounted form, reused on retry so a repeated click never cancels twice.
export function CancelOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline" style={{ flexWrap: "nowrap" }}>
      <input
        aria-label="취소 사유"
        value={reason}
        maxLength={200}
        placeholder="취소 사유"
        style={{ width: 120 }}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        type="button"
        variant="outline"
        disabled={busy || reason.trim().length < 2}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/billing/cancel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId, idempotencyKey: key, reason }),
            });
            const d = await res.json().catch(() => ({}));
            setMessage(
              res.ok ? "" : (d.error?.message ?? "취소하지 못했습니다."),
            );
            if (res.ok) router.refresh();
          } catch {
            setMessage("네트워크 오류입니다. 같은 요청으로 다시 시도해주세요.");
          } finally {
            setBusy(false);
          }
        }}
      >
        TEST 취소
      </Button>
      {message && (
        <span role="alert" className="error">
          {message}
        </span>
      )}
    </span>
  );
}
