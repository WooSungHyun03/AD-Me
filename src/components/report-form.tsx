"use client";
import { useState } from "react";
import { Button } from "./ui/button";
export function ReportForm({ creatorId }: { creatorId: string }) {
  const [message, setMessage] = useState("");
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const d = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...d, creatorId }),
          });
          const data = await res.json();
          setMessage(
            res.ok
              ? "검토 요청이 접수되었습니다. 관리자 검토 전에는 공개되지 않습니다."
              : data.error?.message,
          );
        } catch {
          setMessage("네트워크 오류입니다.");
        }
      }}
    >
      <label className="field">
        정정·신고 사유
        <textarea name="reason" required minLength={10} maxLength={2000} />
      </label>
      <label className="field">
        확인 가능한 출처 URL
        <input name="sourceUrl" type="url" required placeholder="https://" />
      </label>
      <Button>비공개 검토 요청</Button>
      <p role="status">{message}</p>
    </form>
  );
}
