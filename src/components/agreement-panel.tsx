"use client";
import { useRef, useState } from "react";
import {
  agreedTerms,
  pendingOffer,
  type AgreementState,
  type AgreementTerms,
} from "@/lib/agreements";

const kst = (d: string) =>
  new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
function TermsView({ terms }: { terms: AgreementTerms }) {
  return (
    <dl style={{ margin: "8px 0" }}>
      <dt>예산</dt>
      <dd>
        {terms.budgetKrw === null
          ? "미정"
          : `${terms.budgetKrw.toLocaleString()}원`}
      </dd>
      <dt>산출물</dt>
      <dd>{terms.deliverables}</dd>
      <dt>일정</dt>
      <dd>{terms.schedule}</dd>
      {terms.note && (
        <>
          <dt>메모</dt>
          <dd>{terms.note}</dd>
        </>
      )}
    </dl>
  );
}

// D050: proposals become agreed terms only when the other party accepts. The server returns the
// whole state after every write, so the panel never guesses versions on its own.
export function AgreementPanel({ initial }: { initial: AgreementState }) {
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const retry = useRef<{ signature: string; key: string } | null>(null);
  const agreed = agreedTerms(state);
  const open = pendingOffer(state);
  const send = async (body: object, signature: string) => {
    if (retry.current?.signature !== signature)
      retry.current = { signature, key: crypto.randomUUID() };
    setPending(true);
    try {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          proposalId: state.proposalId,
          expectedVersion: state.version,
          offerId:
            "offerId" in body ? (body.offerId as string) : retry.current.key,
        }),
      });
      const d = await res.json();
      if (res.ok) {
        retry.current = null;
        setState(d.state);
        setMessage("저장했습니다.");
      } else setMessage(d.error?.message ?? "저장하지 못했습니다.");
    } catch {
      setMessage(
        "전송 결과를 확인하지 못했습니다. 같은 내용으로 다시 시도해주세요.",
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <div data-testid="agreement">
      <section className="panel" style={{ marginBottom: 20 }}>
        <h2 style={{ marginTop: 0 }}>합의된 조건</h2>
        {agreed ? (
          <>
            <TermsView terms={agreed.terms} />
            <p className="muted" style={{ fontSize: 13 }}>
              양측 확인 · {kst(agreed.confirmedAt ?? agreed.createdAt)}
            </p>
          </>
        ) : (
          <p className="empty">아직 양측이 확인한 조건이 없습니다.</p>
        )}
      </section>
      {open && (
        <section
          className="panel"
          style={{ marginBottom: 20 }}
          data-testid="agreement-pending"
        >
          <h2 style={{ marginTop: 0 }}>
            {open.mine ? "상대 확인 대기 중인 제안" : "상대방이 보낸 조건 제안"}
          </h2>
          <TermsView terms={open.terms} />
          <p className="badge">확정 전 · 양측 확인이 필요합니다</p>
          {!open.mine && state.writable && (
            <button
              className="button primary"
              disabled={pending}
              onClick={() =>
                void send(
                  { action: "accept", offerId: open.id },
                  `accept:${open.id}`,
                )
              }
            >
              이 조건에 동의
            </button>
          )}
        </section>
      )}
      {state.writable ? (
        <form
          className="form-stack panel"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const budget = String(f.get("budget") ?? "").trim();
            const terms = {
              budgetKrw: budget === "" ? null : Number(budget),
              deliverables: String(f.get("deliverables") ?? ""),
              schedule: String(f.get("schedule") ?? ""),
              note: String(f.get("note") ?? ""),
            };
            void send(
              { action: "propose", terms },
              `propose:${JSON.stringify(terms)}`,
            );
          }}
        >
          <h2 style={{ marginTop: 0 }}>조건 변경 제안</h2>
          <label className="field">
            예산 (원, 비우면 미정)
            <input
              name="budget"
              type="number"
              min={0}
              step={1}
              defaultValue={agreed?.terms.budgetKrw ?? ""}
            />
          </label>
          <label className="field">
            산출물
            <textarea
              name="deliverables"
              required
              maxLength={500}
              defaultValue={agreed?.terms.deliverables ?? ""}
            />
          </label>
          <label className="field">
            일정
            <input
              name="schedule"
              required
              maxLength={300}
              defaultValue={agreed?.terms.schedule ?? ""}
            />
          </label>
          <label className="field">
            메모 (선택)
            <input name="note" maxLength={500} />
          </label>
          <p className="muted" style={{ fontSize: 13 }}>
            상대방이 동의해야 합의된 조건이 바뀝니다. 기존 합의는 그대로
            보존됩니다. 이 기록은 전자서명이나 정산 보증이 아닙니다.
          </p>
          <button className="button outline" disabled={pending}>
            조건 제안 보내기
          </button>
        </form>
      ) : (
        <p className="notice">
          종료되었거나 연락이 제한된 협업이라 조건을 바꿀 수 없습니다.
        </p>
      )}
      <p role="status">{message}</p>
      <h2>조건 이력</h2>
      <ol data-testid="agreement-history" style={{ fontSize: 13 }}>
        {state.offers.map((o) => (
          <li key={o.id}>
            {kst(o.createdAt)} · {o.mine ? "내 제안" : "상대 제안"} ·{" "}
            {o.accepted ? "양측 확인" : "확인 전"} · 예산{" "}
            {o.terms.budgetKrw === null
              ? "미정"
              : `${o.terms.budgetKrw.toLocaleString()}원`}
          </li>
        ))}
      </ol>
    </div>
  );
}
