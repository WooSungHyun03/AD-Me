import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { reportKinds, reportStatuses } from "@/lib/schemas";

// One appeal within 30 days of the decision (submit_report enforces it again).
const appealWindowOpen = (decidedAt: string) =>
  Date.now() - new Date(decidedAt).getTime() < 30 * 864e5;
const kst = (d: string) =>
  new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

// D058 requester-only view: RLS returns only this user's requests and their status log. The internal
// creator id is not selected; the browser only sees the ticket, kind, status, deadline and answer.
export async function MyRequests({
  db,
  userId,
}: {
  db: SupabaseClient;
  userId: string;
}) {
  const [{ data: reports, error }, { data: events }] = await Promise.all([
    db
      .from("reports")
      .select(
        "id,ticket_no,kind,status,due_at,interim_hidden,response,decided_at,parent_id,created_at",
      )
      .eq("reporter_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("report_events")
      .select("id,report_id,to_status,created_at")
      .order("id")
      .limit(500),
  ]);
  const appealed = new Set(reports?.map((r) => r.parent_id).filter(Boolean));
  return (
    <section aria-labelledby="my-requests" style={{ marginTop: 32 }}>
      <h2 id="my-requests">내 요청</h2>
      <p className="muted">
        정보 정정·신고·삭제·사칭 요청은 비공개로 처리되며 요청한 본인만 볼 수
        있습니다.
      </p>
      {error && (
        <p className="notice" role="alert">
          요청 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      )}
      {!error && !reports?.length && (
        <p className="empty">접수한 요청이 없습니다.</p>
      )}
      {reports?.map((r) => {
        const canAppeal =
          r.kind !== "appeal" &&
          ["resolved", "dismissed"].includes(r.status) &&
          !appealed.has(r.id) &&
          r.decided_at &&
          appealWindowOpen(r.decided_at);
        return (
          <article
            className="panel"
            style={{ marginBottom: 16 }}
            key={r.id}
            data-testid="my-report"
            data-report-id={r.id}
          >
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong>{r.ticket_no}</strong>
              <span className="badge lime">{reportStatuses[r.status]}</span>
            </div>
            <p style={{ margin: "8px 0" }}>
              {reportKinds[r.kind]} · 처리 기한 {kst(r.due_at)}
              {r.interim_hidden && " · 검토 중 임시 비공개 조치"}
            </p>
            {r.response && (
              <p className="notice">
                <strong>답변</strong>
                <br />
                {r.response}
              </p>
            )}
            <ol className="muted" style={{ fontSize: 13 }}>
              {events
                ?.filter((e) => e.report_id === r.id)
                .map((e) => (
                  <li key={e.id}>
                    {kst(e.created_at)} · {reportStatuses[e.to_status]}
                  </li>
                ))}
            </ol>
            {canAppeal && (
              <Link
                className="button outline small"
                href={`/reports/new?appeal=${r.id}`}
              >
                재심 요청
              </Link>
            )}
          </article>
        );
      })}
    </section>
  );
}
