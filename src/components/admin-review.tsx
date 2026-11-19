"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminReview({ id }: { id: string }) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <div className="inline">
      {["reviewed", "dismissed"].map((status) => (
        <button
          className="button outline small"
          key={status}
          onClick={async () => {
            const res = await fetch("/api/admin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id, status }),
            });
            if (res.ok) router.refresh();
            else setMessage("처리 권한이 없거나 실패했습니다.");
          }}
        >
          {status === "reviewed" ? "검토 완료" : "반려"}
        </button>
      ))}
      <span role="status">{message}</span>
    </div>
  );
}
