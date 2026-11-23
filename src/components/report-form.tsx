"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
export function ReportForm({ creatorId }: { creatorId: string; parentId?: string; initialKind?: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false),
    retry = useRef<{ signature: string; key: string } | null>(null);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending.current) return;
        const d = Object.fromEntries(new FormData(e.currentTarget));
        const payload = { ...d, creatorId },
          signature = JSON.stringify(payload);
        if (retry.current?.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        sending.current = true;
        setPending(true);
        try {
          const res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, clientKey: retry.current.key }),
          });
          const data = await res.json();
          if (res.ok) retry.current = null;
          setMessage(
            res.ok
              ? "검토 요청이 접수되었습니다. 관리자 검토 전에는 공개되지 않습니다."
              : data.error?.message,
          );
        } catch {
          setMessage(
            "전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
          );
        } finally {
          sending.current = false;
          setPending(false);
        }
      }}
    >
      <label className="field">
        자료 구분
        <select name="evidenceKind" disabled={pending}>
          <option value="claim">미확인 주장</option>
          <option value="source">출처 자료</option>
          <option value="official_statement">공식 입장</option>
          <option value="correction">공식 정정</option>
        </select>
      </label>
      <label className="field">
        정정·신고 사유
        <textarea name="reason" required minLength={10} maxLength={2000} />
      </label>
      <label className="field">
        확인 가능한 출처 URL
        <input name="sourceUrl" type="url" required placeholder="https://" />
      </label>
      <Button disabled={pending}>비공개 검토 요청</Button>
      <p role="status">{message}</p>
      <Link href="/reports">제출·정정·당사자 입장 확인 ↗</Link>
    </form>
  );
}
