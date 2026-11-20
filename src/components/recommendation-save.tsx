"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function RecommendationSave({
  campaignId,
  hasSnapshot,
}: {
  campaignId: string;
  hasSnapshot: boolean;
}) {
  const router = useRouter(),
    key = useRef<string | null>(null),
    busy = useRef(false);
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function save() {
    if (busy.current) return;
    key.current ??= crypto.randomUUID();
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, clientKey: key.current }),
      });
      if (!res.ok) {
        setMessage(
          "저장하지 못했습니다. 잠시 후 같은 요청으로 다시 시도해주세요.",
        );
        return;
      }
      key.current = null;
      router.push(`/campaigns/${campaignId}/recommendations`);
      router.refresh();
    } catch {
      setMessage(
        "전송 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <div className="form-stack">
      <button
        type="button"
        className="button primary"
        onClick={save}
        disabled={pending}
      >
        {pending
          ? "추천 저장 중…"
          : hasSnapshot
            ? "현재 데이터로 재계산·새 결과 저장"
            : "현재 추천 저장"}
      </button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
