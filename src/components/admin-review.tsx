"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminReview({
  id,
  status,
  hidden,
}: {
  id: string;
  status: string;
  hidden: boolean;
}) {
  const [message, setMessage] = useState(""),
    [response, setResponse] = useState(""),
    [hide, setHide] = useState(hidden);
  const router = useRouter();
  const send = async (next: string) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: next,
        response,
        hide: hide === hidden ? undefined : hide,
      }),
    });
    if (res.ok) router.refresh();
    else setMessage((await res.json()).error?.message ?? "처리 실패");
  };
  if (!["pending", "in_review"].includes(status)) return null;
  return (
    <div className="form-stack" style={{ marginTop: 12 }}>
      <label className="inline">
        <input
          type="checkbox"
          checked={hide}
          onChange={(e) => setHide(e.target.checked)}
        />
        검토 중 프로필 임시 비공개
      </label>
      <label className="field">
        요청자에게 보낼 답변
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          maxLength={2000}
        />
      </label>
      <div className="inline">
        {status === "pending" && (
          <button
            className="button outline small"
            onClick={() => send("in_review")}
          >
            검토 시작
          </button>
        )}
        <button
          className="button outline small"
          onClick={() => send("resolved")}
        >
          처리 완료
        </button>
        <button
          className="button outline small"
          onClick={() => send("dismissed")}
        >
          반려
        </button>
      </div>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </div>
  );
}
