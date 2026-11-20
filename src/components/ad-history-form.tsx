"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdHistoryFields, adPayloadFromForm } from "./ad-history-fields";
export function AdHistoryForm({ creatorId }: { creatorId: string }) {
  const [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const busy = useRef(false),
    retry = useRef<{ signature: string; key: string } | null>(null),
    router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy.current) return;
        const f = new FormData(e.currentTarget),
          payload = {
            ...adPayloadFromForm(f),
            ownershipConfirmed: f.get("ownershipConfirmed") === "on",
          },
          signature = JSON.stringify(payload);
        if (retry.current?.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        busy.current = true;
        setPending(true);
        try {
          const res = await fetch("/api/ad-history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              creatorId,
              payload,
              clientKey: retry.current.key,
            }),
          });
          const d = await res.json();
          if (!res.ok)
            throw new Error(d.error?.message || "제출하지 못했습니다.");
          retry.current = null;
          router.push("/reports");
          router.refresh();
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
          );
        } finally {
          busy.current = false;
          setPending(false);
        }
      }}
    >
      <AdHistoryFields />
      <p>
        로고·콘텐츠를 복제하지 않습니다. 단순 언급이나 본인 진술만으로 확인된
        광고로 공개하지 않습니다.
      </p>
      <button className="button primary" disabled={pending}>
        광고 이력 검토 요청
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
