"use client";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  supportLabels,
  supportScopes,
  supportPageSchema,
  type supportInputSchema,
} from "@/lib/admin-support";
import type { z } from "zod";
import { Moderate } from "./moderate";
import { AdminReview } from "./admin-review";
import { AdminRestrict } from "./safety";
const subscribe = () => () => {};
export function AdminSearch({ role }: { role: string }) {
  const interactive = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const allowed = supportScopes[role] ?? [],
    [kind, setKind] = useState<z.infer<typeof supportInputSchema>["kind"]>(
      allowed[0] ?? "members",
    ),
    [query, setQuery] = useState(""),
    [reason, setReason] = useState(""),
    [page, setPage] = useState<z.infer<typeof supportPageSchema> | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [applied, setApplied] = useState({ kind, query, reason });
  const seq = useRef(0);
  async function search(more = false) {
    const current = more ? applied : { kind, query, reason },
      generation = ++seq.current;
    setPending(true);
    setError("");
    if (!more) setPage(null);
    try {
      const res = await fetch("/api/admin/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...current,
          cursor: more ? page?.nextCursor : null,
        }),
      });
      if (!res.ok) throw Error();
      const result = supportPageSchema.parse(await res.json());
      if (seq.current !== generation) return;
      setPage({
        ...result,
        items: more ? [...page!.items, ...result.items] : result.items,
      });
      setApplied(current);
    } catch {
      if (seq.current === generation) {
        setPage(null);
        setError(
          "검색을 수행하지 못했습니다. 권한·OTP·조회 사유를 확인하고 다시 시도해주세요.",
        );
      }
    } finally {
      if (seq.current === generation) setPending(false);
    }
  }
  return (
    <section aria-busy={pending}>
      <h2>업무별 운영 검색</h2>
      <p>
        허가된 업무 범위에서 최대 20개씩 조회합니다. 이메일·인증정보·수집
        원문·결제 키는 제공하지 않습니다. 권한 변경과 대량 반출은 이 화면에서
        제공하지 않습니다.
      </p>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <label className="field">
          운영 검색 대상
          <select
            disabled={!interactive || pending}
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            {allowed.map((k) => (
              <option key={k} value={k}>
                {supportLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          운영 검색어
          <input
            disabled={!interactive || pending}
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="field">
          조회 사유
          <input
            disabled={!interactive || pending}
            value={reason}
            minLength={5}
            maxLength={500}
            required
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <p>
          사유에 비밀번호나 불필요한 개인정보를 입력하지 마세요. 조회와 변경은
          감사 기록으로 남습니다.
        </p>
        <button
          className="button primary"
          disabled={pending || reason.trim().length < 5}
        >
          운영 검색
        </button>
      </form>
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {page && (
        <div data-testid="admin-search-results">
          <p role="status">
            {supportLabels[page.kind]} {page.items.length}개 표시
            {page.nextCursor ? " · 다음 페이지 있음" : ""}
          </p>
          {!page.items.length && <p className="empty">검색 결과가 없습니다.</p>}
          {page.items.map((r) => (
            <article
              className="panel"
              key={r.id}
              data-testid="admin-record"
              style={{ marginBottom: 16, overflowWrap: "anywhere" }}
            >
              <h3>{r.label}</h3>
              <p>
                {r.status} · {r.id} ·{" "}
                {new Date(r.createdAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                (KST)
              </p>
              {r.details.isDemo && <span className="badge">DEMO</span>}
              {r.details.amount !== undefined && (
                <p>TEST {r.details.amount.toLocaleString()}원</p>
              )}
              {r.details.attempts !== undefined && (
                <p>실행 시도 {r.details.attempts}회</p>
              )}
              {r.details.reason && (
                <p>
                  {r.details.actor} · {r.details.target} · 요청{" "}
                  {r.details.requestId}
                  <br />
                  {r.details.reason}
                </p>
              )}
              {role === "super" && page.kind === "creators" && (
                <Moderate
                  kind="creator"
                  id={r.id}
                  restricted={r.details.moderation === "restricted"}
                  onChanged={() => void search()}
                />
              )}{" "}
              {role === "super" && page.kind === "campaigns" && (
                <Moderate
                  kind="campaign"
                  id={r.id}
                  restricted={r.details.moderation === "restricted"}
                  onChanged={() => void search()}
                />
              )}{" "}
              {role === "super" && page.kind === "reports" && (
                <AdminReview id={r.id} onChanged={() => void search()} />
              )}
              {/* D062: temporary contact restriction for a report under review; restrict_contact
                  re-checks the admin, the open status and that the profile has an account. */}
              {role === "super" &&
                page.kind === "reports" &&
                ["pending", "in_review"].includes(r.status) && (
                  <AdminRestrict reportId={r.id} />
                )}
            </article>
          ))}
          {page.nextCursor && (
            <button
              className="button outline"
              disabled={pending}
              onClick={() => void search(true)}
            >
              다음 운영 결과
            </button>
          )}
        </div>
      )}
    </section>
  );
}
