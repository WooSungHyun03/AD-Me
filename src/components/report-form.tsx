"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";
export function ReportForm({
  creatorId,
  parentId,
  initialKind,
}: {
  creatorId: string;
  parentId?: string;
  initialKind?: string;
}) {
  const [kind, setKind] = useState(
    parentId
      ? "appeal"
      : ["correction", "deletion", "report", "impersonation"].includes(
            initialKind ?? "",
          )
        ? initialKind!
        : "correction",
  );
  const [message, setMessage] = useState(""),
    [ticket, setTicket] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        const d = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...d, kind, creatorId, parentId }),
          });
          const data = await res.json();
          if (res.ok) {
            setTicket(data.ticket_no);
            setMessage("");
          } else setMessage(data.error?.message ?? "접수 실패");
        } catch {
          setMessage("네트워크 오류입니다.");
        } finally {
          setPending(false);
        }
      }}
    >
      {!parentId && (
        <label className="field">
          요청 유형
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="correction">정보 정정</option>
            <option value="report">신고 (부적절·스팸 등)</option>
            <option value="impersonation">사칭 신고 (운영자 직접 검토)</option>
            <option value="deletion">삭제 요청 (본인 또는 권리자)</option>
          </select>
        </label>
      )}
      <label className="field">
        {parentId ? "재심 사유" : "요청 사유"}
        <textarea name="reason" required minLength={10} maxLength={2000} />
      </label>
      {(kind === "report" ||
        kind === "correction" ||
        kind === "impersonation") && (
        <label className="field">
          확인 가능한 출처 URL
          <input name="sourceUrl" type="url" required placeholder="https://" />
        </label>
      )}
      {kind === "impersonation" && (
        <p className="notice" style={{ fontSize: 13 }}>
          사칭 신고는 신고 수와 관계없이 운영자가 직접 확인한 뒤에만 조치합니다.
          본인의 공식 채널 등 확인 가능한 출처를 적어주세요.
        </p>
      )}
      {kind === "deletion" && (
        <p className="notice" style={{ fontSize: 13 }}>
          프로필 소유 계정으로 요청하면 본인 확인이 자동으로 처리됩니다. 그
          외에는 관리자가 권리 관계를 확인합니다. 처리 기한은 접수 후
          10일입니다.
        </p>
      )}
      <Button disabled={pending || Boolean(ticket)}>
        {pending ? "접수 중…" : "비공개로 요청하기"}
      </Button>
      {ticket && (
        <p role="status">
          접수번호 <strong>{ticket}</strong>. 요청은 공개되지 않으며{" "}
          <Link href="/reports">내 요청</Link>에서 처리 상태를 확인할 수
          있습니다.
        </p>
      )}
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
    </form>
  );
}
