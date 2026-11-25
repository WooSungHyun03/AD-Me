"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "./ui/button";

// D057 evidence review stays the default ("evidence"). The D058 request kinds go to the private request
// queue (ticket number, deadline, interim hide, one appeal) shown under "내 요청" on /reports.
const requestKinds = ["correction", "report", "impersonation", "deletion"];

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
      : requestKinds.includes(initialKind ?? "")
        ? initialKind!
        : "evidence",
  );
  const [message, setMessage] = useState("");
  const [ticket, setTicket] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false),
    retry = useRef<{ signature: string; key: string } | null>(null);
  const evidence = kind === "evidence";
  const needsSource = ["report", "correction", "impersonation"].includes(kind);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (sending.current) return;
        const d = Object.fromEntries(new FormData(e.currentTarget));
        const payload = evidence
          ? { ...d, creatorId }
          : { ...d, kind, creatorId, ...(parentId ? { parentId } : {}) };
        const signature = JSON.stringify(payload);
        if (retry.current?.signature !== signature)
          retry.current = { signature, key: crypto.randomUUID() };
        sending.current = true;
        setPending(true);
        try {
          const res = await fetch("/api/reports", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              evidence ? { ...payload, clientKey: retry.current.key } : payload,
            ),
          });
          const data = await res.json();
          if (res.ok) retry.current = null;
          if (res.ok && !evidence) {
            setTicket(data.ticketNo);
            setMessage("");
          } else
            setMessage(
              res.ok
                ? "검토 요청이 접수되었습니다. 관리자 검토 전에는 공개되지 않습니다."
                : (data.error?.message ?? "접수하지 못했습니다."),
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
      {!parentId && (
        <label className="field">
          요청 유형
          <select
            value={kind}
            disabled={pending || Boolean(ticket)}
            onChange={(e) => {
              setKind(e.target.value);
              setMessage("");
            }}
          >
            <option value="evidence">근거 자료 검토 (당사자 입장 포함)</option>
            <option value="correction">정보 정정</option>
            <option value="report">신고 (부적절·스팸 등)</option>
            <option value="impersonation">사칭 신고 (운영자 직접 검토)</option>
            <option value="deletion">삭제 요청 (본인 또는 권리자)</option>
          </select>
        </label>
      )}
      {evidence && (
        <label className="field">
          자료 구분
          <select name="evidenceKind" disabled={pending}>
            <option value="claim">미확인 주장</option>
            <option value="source">출처 자료</option>
            <option value="official_statement">공식 입장</option>
            <option value="correction">공식 정정</option>
          </select>
        </label>
      )}
      <label className="field">
        {evidence ? "정정·신고 사유" : parentId ? "재심 사유" : "요청 사유"}
        <textarea name="reason" required minLength={10} maxLength={2000} />
      </label>
      {(evidence || needsSource) && (
        <label className="field">
          확인 가능한 출처 URL
          <input name="sourceUrl" type="url" required placeholder="https://" />
        </label>
      )}
      {kind === "impersonation" && (
        <p className="notice">
          사칭 신고는 신고 수와 관계없이 운영자가 직접 확인한 뒤에만 조치합니다.
          본인의 공식 채널 등 확인 가능한 출처를 적어주세요.
        </p>
      )}
      {kind === "deletion" && (
        <p className="notice">
          프로필 소유 계정으로 요청하면 본인 확인이 자동으로 처리됩니다. 그
          외에는 관리자가 권리 관계를 확인합니다. 처리 기한은 접수 후
          10일입니다.
        </p>
      )}
      <Button disabled={pending || Boolean(ticket)}>
        {pending
          ? "접수 중…"
          : evidence
            ? "비공개 검토 요청"
            : "비공개로 요청하기"}
      </Button>
      <p role="status">
        {ticket ? (
          <>
            접수번호 <strong>{ticket}</strong>. 요청은 공개되지 않으며{" "}
            <Link href="/reports">내 요청</Link>에서 처리 상태를 확인할 수
            있습니다.
          </>
        ) : (
          message
        )}
      </p>
      {evidence && <Link href="/reports">제출·정정·당사자 입장 확인 ↗</Link>}
    </form>
  );
}
