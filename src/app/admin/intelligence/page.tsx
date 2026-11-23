import { YoutubeOpsSummary } from "@/components/youtube-ops-summary";
import Link from "next/link";
import { redirect } from "next/navigation";
import { featuredYoutube } from "@/lib/featured-youtube";
import { context } from "@/lib/api";
import { Command } from "./commands";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name?: string;
  role?: string;
  title?: string;
  sku?: string;
  amount?: number;
  status?: string;
  created_at: string;
};
type Channel = {
  channel_id: string;
  title: string;
  review: string;
  subscriber_count: number | null;
  fetched_at: string;
  videos: { id: string; title: string }[];
};
type Job = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  error_code: string | null;
  elapsed_ms: number | null;
};
type Overview = {
  role: string;
  members: Row[] | null;
  orders: Row[] | null;
  campaigns: Row[] | null;
  channels: Channel[] | null;
  jobs: Job[] | null;
  keyword: string;
  discoveryEnabled: boolean;
};
export default async function Intelligence() {
  const c = await context();
  if (!c) redirect("/login");
  const { data: role, error: accessError } = await c.db.rpc("ops_current_role");
  if (accessError)
    return (
      <section className="wrap">
        <h1>운영 콘솔에 연결할 수 없습니다.</h1>
      </section>
    );
  if (!role) {
    const { data: enrollment } = await c.db.rpc("ops_enrollment_role");
    if (enrollment) redirect("/admin/security");
    return (
      <section className="wrap">
        <h1>관리자 권한이 필요합니다.</h1>
      </section>
    );
  }
  const { data, error } = await c.db.rpc("ops_dashboard");
  if (error || !data)
    return (
      <section className="wrap">
        <h1>운영 데이터를 불러오지 못했습니다.</h1>
        <p>잠시 후 새로고침해주세요.</p>
      </section>
    );
  const ops = data as Overview;
  const publicIds = new Set(
    ops.channels
      ? (await featuredYoutube("", null, 50)).items.map(
          (channel) => channel.channel_id,
        )
      : [],
  );
  const reports = ["super", "support"].includes(ops.role)
    ? await c.db.rpc("chat_report_queue")
    : null;
  const reportRows = (reports?.data ?? []) as {
    proposal_id: string;
    reason: string;
    created_at: string;
  }[];

  return (
    <section className="wrap">
      <h1 className="page-title">운영 콘솔</h1>
      <p>
        운영 역할 <strong>{ops.role}</strong>
      </p>
      <nav aria-label="운영 메뉴" className="ops-nav">
        {ops.channels && <a href="#youtube">YouTube 수집</a>}
        {ops.jobs && <a href="#jobs">작업 모니터</a>}
        {ops.members && <a href="#members">회원</a>}
        {ops.campaigns && <a href="#campaigns">캠페인</a>}
        {ops.orders && <a href="#orders">TEST 결제</a>}
        {ops.role === "super" && <Link href="/admin">기존 운영 화면</Link>}
        {reports && <a href="#chat-reports">채팅 신고</a>}
      </nav>
      {reports && (
        <section id="chat-reports" className="ops-section">
          <h2>채팅 신고</h2>
          {reports.error ? (
            <p role="alert">채팅 신고를 불러오지 못했습니다.</p>
          ) : reportRows.length ? (
            reportRows.map((report) => (
              <article
                className="ops-row"
                key={report.proposal_id + report.created_at}
              >
                <strong>{report.proposal_id}</strong>
                <p>{report.reason}</p>
              </article>
            ))
          ) : (
            <p>접수한 채팅 신고가 없습니다.</p>
          )}
        </section>
      )}
      {ops.channels && (
        <section id="youtube" className="ops-section">
          <h2>YouTube 수집</h2>
          <YoutubeOpsSummary channels={ops.channels} jobs={ops.jobs} />
          <p>
            후보 채널의 검토 상태는 내부에서 관리합니다. 채널 소유권과 AD Me
            가입 여부는 별도입니다.
          </p>
          <div className="ops-grid">
            <div className="panel">
              <h3>채널 등록</h3>
              <Command action="channel" />
            </div>
            {ops.role === "super" && (
              <div className="panel">
                <h3>일일 일정</h3>
                <Command
                  action="discovery"
                  keyword={ops.keyword}
                  enabled={ops.discoveryEnabled}
                />
              </div>
            )}
          </div>
          {!ops.channels.length && <p>수집된 채널이 없습니다.</p>}
          {ops.channels.map((channel) => (
            <details key={channel.channel_id} className="ops-row">
              <summary>
                {channel.title} ·{" "}
                {{
                  pending: "검토 대기",
                  accepted: "내부 승인",
                  rejected: "반려",
                }[channel.review] ?? channel.review}
              </summary>
              <p>
                <a
                  href={"https://www.youtube.com/channel/" + channel.channel_id}
                  target="_blank"
                  rel="noreferrer"
                >
                  {channel.channel_id} · 원본 채널
                </a>
                {publicIds.has(channel.channel_id) && (
                  <>
                    {" "}
                    ·{" "}
                    <Link href={`/creators/youtube/${channel.channel_id}`}>
                      공개 상세 프로필
                    </Link>
                  </>
                )}
              </p>
              <p>
                구독자{" "}
                {channel.subscriber_count?.toLocaleString("ko-KR") ?? "비공개"}{" "}
                · 갱신 {channel.fetched_at.slice(0, 10)}
              </p>
              <ul>
                {channel.videos.map((video) => (
                  <li key={video.id}>
                    <a
                      href={
                        "https://www.youtube.com/watch?v=" +
                        encodeURIComponent(video.id)
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {video.title}
                    </a>
                  </li>
                ))}
              </ul>
              <Command action="review" fixedValue={channel.channel_id} />
            </details>
          ))}
        </section>
      )}
      {ops.jobs && (
        <section id="jobs" className="ops-section">
          <h2>수집·AI 작업</h2>
          {ops.jobs.length ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>작업</th>
                    <th>상태</th>
                    <th>시도</th>
                    <th>처리 시간</th>
                    <th>오류</th>
                  </tr>
                </thead>
                <tbody>
                  {ops.jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.kind}</td>
                      <td>{job.status}</td>
                      <td>{job.attempts}</td>
                      <td>
                        {job.elapsed_ms === null ? "—" : `${job.elapsed_ms} ms`}
                      </td>
                      <td>{job.error_code ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>등록된 작업이 없습니다.</p>
          )}
        </section>
      )}
      {ops.members && (
        <section id="members" className="ops-section">
          <h2>최근 회원</h2>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>이름</th>
                  <th>계정 유형</th>
                  <th>회원 ID</th>
                </tr>
              </thead>
              <tbody>
                {ops.members.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.role}</td>
                    <td>{row.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ops.role === "super" && (
            <details className="ops-row">
              <summary>운영 역할 부여</summary>
              <Command action="staff" />
            </details>
          )}
        </section>
      )}
      {ops.campaigns && (
        <section id="campaigns" className="ops-section">
          <h2>최근 캠페인</h2>
          <ul>
            {ops.campaigns.map((row) => (
              <li key={row.id}>
                {row.title} · {row.status}
              </li>
            ))}
          </ul>
        </section>
      )}
      {ops.orders && (
        <section id="orders" className="ops-section">
          <h2>최근 TEST 주문</h2>
          <ul>
            {ops.orders.map((row, index) => (
              <li key={index}>
                {row.sku} · {row.amount?.toLocaleString("ko-KR")}원 ·{" "}
                {row.status}
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
