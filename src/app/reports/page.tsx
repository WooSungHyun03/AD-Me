import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { reportKinds, reportStatuses } from "@/lib/schemas";
const kst = (d: string) =>
  new Date(d).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
// Requester-only view: RLS returns just this user's requests and their status log.
export default async function MyReports() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/reports");
  const db = await supabase();
  const [{ data: reports }, { data: events }] = await Promise.all([
    db
      .from("reports")
      .select(
        "id,ticket_no,kind,creator_id,status,due_at,interim_hidden,response,decided_at,parent_id,created_at",
      )
      .eq("reporter_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("report_events")
      .select("id,report_id,to_status,created_at")
      .order("id"),
  ]);
  const now = new Date();
  const appealed = new Set(reports?.map((r) => r.parent_id).filter(Boolean));
  return (
    <section className="wrap">
      <span className="eyebrow">My requests</span>
      <h1 className="page-title">내 요청</h1>
      {!reports?.length && <p className="empty">접수한 요청이 없습니다.</p>}
      {reports?.map((r) => {
        const canAppeal =
          r.kind !== "appeal" &&
          ["resolved", "dismissed"].includes(r.status) &&
          !appealed.has(r.id) &&
          r.decided_at &&
          now.getTime() - new Date(r.decided_at).getTime() < 30 * 864e5;
        return (
          <article
            className="panel"
            style={{ marginBottom: 16 }}
            key={r.id}
            data-testid="my-report"
          >
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong>{r.ticket_no}</strong>
              <span className="badge lime">{reportStatuses[r.status]}</span>
            </div>
            <p style={{ margin: "8px 0" }}>
              {reportKinds[r.kind]} ·{" "}
              {r.creator_id ? (
                <Link href={`/creators/${r.creator_id}`}>대상 프로필</Link>
              ) : (
                "보관된 대상 프로필"
              )}{" "}
              · 처리 기한 {kst(r.due_at)}
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
