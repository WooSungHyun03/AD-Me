"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function Moderate({
  id,
  kind,
  published,
}: {
  id: string;
  kind: "creator" | "campaign";
  published: boolean;
}) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <>
      <button
        className="button outline small"
        onClick={async () => {
          try {
            const res = await fetch("/api/admin/moderate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, kind, published: !published }),
            });
            setMessage(res.ok ? "처리했습니다." : "처리하지 못했습니다.");
            if (res.ok) router.refresh();
          } catch {
            setMessage("네트워크 오류입니다.");
          }
        }}
      >
        {kind === "creator"
          ? published
            ? "비공개 처리"
            : "공개 처리"
          : "모집 마감"}
      </button>
      <span role="status">{message}</span>
    </>
  );
}
