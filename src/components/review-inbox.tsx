import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readReviewInbox } from "@/lib/review-server";
import { ReviewCaseActions } from "./review-case-actions";
export async function ReviewInbox({
  db,
  cursor,
  path,
}: {
  db: Pick<SupabaseClient, "rpc">;
  cursor?: string;
  path: string;
}) {
  const page = await readReviewInbox(db, cursor);
  const status = {
    pending: "검토 대기",
    approved: "검토 승인",
    rejected: "반려",
    withdrawn: "철회",
  };
  return (
    <>
      {!page.items.length && (
        <p className="notice">확인할 검토 자료가 없습니다.</p>
      )}
      {page.items.map((item) => (
        <article
          className="panel"
          key={item.id}
          style={{ marginBottom: 20, overflowWrap: "anywhere" }}
          data-testid="review-case"
        >
          <div className="inline">
            <span className="badge">{status[item.status]}</span>
            <span>버전 {item.version}</span>
            {item.isDemo && <span className="badge">DEMO 대상</span>}
            <span>
              {item.publicVisible
                ? "공개 승인됨 · 정책/프로필 조건에 따라 표시"
                : "비공개"}
            </span>
          </div>
          <h2>{item.payload.reason}</h2>
          <Link href={`/creators/${item.creatorId}`}>대상 프로필 ↗</Link>
          {" · "}
          <a
            href={item.payload.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            제출 출처 ↗
          </a>
          <p>
            제출 자료는 확인된 사실과 구분합니다. 검토 결과를 위험 점수로
            환산하지 않습니다.
          </p>
          <details>
            <summary>제출·정정 이력 ({item.history.length})</summary>
            {item.history.map((h) => (
              <div className="notice" key={h.version}>
                <strong>버전 {h.version}</strong>
                <p>{h.payload.reason}</p>
                <a
                  href={h.payload.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  해당 버전 출처 ↗
                </a>
              </div>
            ))}
          </details>
          {item.responses.map((r, i) => (
            <div className="notice" key={i}>
              <strong>당사자 입장 · 버전 {r.version}</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.body}</p>
              {r.sourceUrl && (
                <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                  입장 출처 ↗
                </a>
              )}
              <p>
                {r.publishConsent ? "공개 동의 · 검토 필요" : "비공개 입장"}
              </p>
            </div>
          ))}
          {item.decisions.map((d) => (
            <div className="notice" key={d.version}>
              <strong>검토 기록 · 버전 {d.version}</strong>
              <p>
                {d.verdict === "approved" ? "승인" : "반려"} ·{" "}
                {d.classification}
              </p>
              <p>{d.summary}</p>
              {d.note && <p>내부 근거: {d.note}</p>}
              <time dateTime={d.reviewedAt}>
                {new Date(d.reviewedAt).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </time>
            </div>
          ))}
          <ReviewCaseActions item={item} />
        </article>
      ))}
      {page.nextCursor && (
        <Link
          className="button outline"
          href={`${path}?cursor=${page.nextCursor}`}
        >
          이전 검토 자료
        </Link>
      )}
    </>
  );
}
