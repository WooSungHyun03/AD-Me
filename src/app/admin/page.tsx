import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { details } from "@/lib/health";
import { Moderate } from "@/components/moderate";
import { AdminReview } from "@/components/admin-review";
import {
  AdminRestrict,
  LiftRestriction,
  RetentionControls,
} from "@/components/safety";
import { ClaimReview } from "@/components/claim";
import { reportKinds, reportStatuses } from "@/lib/schemas";
import { conversion, EVENT_RETENTION_DAYS } from "@/lib/analytics";
import { evaluate, type FeedbackRow } from "@/lib/matching-eval";
import { configuredSender } from "@/lib/notifications/email";
import Link from "next/link";
import { AnswerInquiry } from "@/components/inquiry-form";
import {
  GrantEntitlement,
  RevokeEntitlement,
} from "@/components/entitlement-admin";
import { inquiryCategories } from "@/lib/schemas";
type Metrics = {
  period: { days: number; from: string; to: string };
  excluded: { test_accounts: number; demo_campaigns: number };
  activity: Record<string, number>;
  reports: Record<string, number | null>;
  errors: { total: number; top: { route: string; kind: string; n: number }[] };
  inquiries: Record<string, number>;
};
// D063: each number is shown with its definition; test accounts and demo data never count.
const METRIC_ROWS: [string, (m: Metrics) => number | null, string][] = [
  ["신규 가입", (m) => m.activity.signups, "기간 내 가입한 계정 수"],
  [
    "활성 사용자",
    (m) => m.activity.active_users,
    "기간 내 1회 이상 로그인한 계정 수",
  ],
  [
    "캠페인 생성",
    (m) => m.activity.campaigns_created,
    "기간 내 생성된 비데모 캠페인 수",
  ],
  [
    "제안·지원",
    (m) => m.activity.proposals_created,
    "기간 내 생성된 제안·지원 수",
  ],
  [
    "협업 수락",
    (m) => m.activity.accepted,
    "기간 내 수락 상태로 전환된 협업 수(상태 기록 기준)",
  ],
  [
    "신고·요청 접수",
    (m) => m.reports.received,
    "기간 내 접수된 신고·정정·삭제·이의신청",
  ],
  [
    "신고 처리 완료",
    (m) => m.reports.closed,
    "기간 내 처리 완료·기각 결정된 건",
  ],
  [
    "처리 시간 중앙값(시간)",
    (m) => m.reports.median_hours,
    "기간 내 결정된 건의 접수→결정 시간 중앙값",
  ],
  [
    "기한 초과 미처리",
    (m) => m.reports.open_overdue,
    "현재 미처리이면서 처리 기한이 지난 건",
  ],
  [
    "서버 오류",
    (m) => m.errors.total,
    "기간 내 서버에서 포착된 오류 수(경로별, 내용·사용자 미저장)",
  ],
  ["문의 접수", (m) => m.inquiries.received, "기간 내 접수된 문의"],
  ["문의 답변", (m) => m.inquiries.answered, "기간 내 답변·종료된 문의"],
  ["미답변 문의", (m) => m.inquiries.open, "현재 답변 대기 중인 문의"],
];
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const days = [7, 30, 90].includes(Number((await searchParams).days))
    ? Number((await searchParams).days)
    : 30;
  const c = await context();
  if (!c) redirect("/login?next=/admin");
  if (c.role !== "admin")
    return (
      <section className="wrap">
        <h1 className="page-title">관리자 권한이 필요합니다.</h1>
        <p>운영 데이터는 허가된 관리자에게만 공개됩니다.</p>
      </section>
    );
  const [{ data: creatorRows }, { data: campaignRows }, { data: passes }] =
    await Promise.all([
      c.db.from("creators").select("id,profile,published").limit(100),
      c.db.from("campaigns").select("id,brief,status").limit(100),
      c.db
        .from("entitlements")
        .select(
          "id,sku,expires_at,credits,grant_reason,grant_note,revoked_at,revoke_reason,profiles!entitlements_owner_id_fkey(name)",
        )
        .order("expires_at", { ascending: false })
        .limit(100),
    ]);
  const [
    { data: members },
    { data: reports },
    { data: payments },
    { data: audit },
    { count: campaigns },
    { count: creators },
    { data: claims },
    { data: runs },
    { count: tombstones },
  ] = await Promise.all([
    c.db.from("profiles").select("id,name,role,created_at"),
    c.db.from("reports").select("*").order("due_at", { ascending: true }),
    c.db.from("orders").select("id,sku,amount,status"),
    c.db
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    c.db.from("campaigns").select("id", { count: "exact", head: true }),
    c.db.from("creators").select("id", { count: "exact", head: true }),
    c.db
      .from("creator_claims")
      .select("id,creator_id,claimant_id,expires_at,created_at")
      .eq("status", "pending")
      .order("created_at"),
    c.db
      .from("retention_runs")
      .select("id,started_at,status,counts,error")
      .order("id", { ascending: false })
      .limit(5),
    c.db
      .from("deletion_tombstones")
      .select("id", { count: "exact", head: true }),
  ]);
  const health = await details(c.db);
  const { data: funnel } = await c.db.rpc("product_funnel", { p_days: 30 });
  const { data: fbRows } = await c.db.rpc("matching_feedback_dataset");
  const { data: outbox } = await c.db.rpc("email_outbox_stats");
  const { data: metricsRaw } = await c.db.rpc("ops_metrics", { p_days: days });
  const { data: skuRows } = await c.db
    .from("products")
    .select("sku")
    .order("sku");
  const metrics = metricsRaw as Metrics | null;
  const { data: inquiries } = await c.db
    .from("inquiries")
    .select("id,category,message,reply_email,user_id,status,created_at")
    .neq("status", "closed")
    .order("created_at")
    .limit(50);
  const ob = (outbox ?? {}) as Record<string, number>;
  const fb = (fbRows ?? []) as FeedbackRow[];
  const fbVersion = fb.at(-1)?.model_version ?? "adme-1.1";
  const fbEval = evaluate(fb, fbVersion);
  const targetIds = [...new Set((reports ?? []).map((r) => r.creator_id))];
  const [{ data: owned }, { data: restrictions }] = await Promise.all([
    c.db
      .from("creators")
      .select("id,owner_id")
      .in("id", targetIds)
      .not("owner_id", "is", null),
    c.db
      .from("contact_restrictions")
      .select(
        "id,user_id,reason,ends_at,appeal,appealed_at,lifted_at,report_id",
      )
      .is("lifted_at", null)
      .order("ends_at"),
  ]);
  const ownerOf = new Map(
    (owned ?? []).map((o) => [o.id, o.owner_id as string]),
  );
  const now = new Date();
  // Accumulation = distinct requesters in 30 days; a review signal only, never an automatic sanction.
  const signal = new Map<string, number>();
  for (const id of targetIds)
    signal.set(
      id,
      new Set(
        (reports ?? [])
          .filter(
            (r) =>
              r.creator_id === id &&
              ["report", "impersonation"].includes(r.kind) &&
              now.getTime() - Date.parse(r.created_at) < 30 * 86400000,
          )
          .map((r) => r.reporter_id),
      ).size,
    );
  const isClosed = (s: string) => ["resolved", "dismissed"].includes(s);
  return (
    <section className="wrap">
      <span className="eyebrow">Operations / admin only</span>
      <h1 className="page-title">서비스 운영 현황.</h1>
      <div className="metric-row">
        <div>
          <strong>{members?.length ?? 0}</strong>
          <span>회원</span>
        </div>
        <div>
          <strong>{creators ?? 0}</strong>
          <span>등록 프로필 (DEMO 포함)</span>
        </div>
        <div>
          <strong>{campaigns ?? 0}</strong>
          <span>캠페인 (DEMO 포함)</span>
        </div>
        <div>
          <strong>
            {reports?.filter((r) => ["pending", "in_review"].includes(r.status))
              .length ?? 0}
          </strong>
          <span>미처리 신고</span>
        </div>
      </div>
      <h2>신고·데이터 검토</h2>
      {[...(reports ?? [])]
        // open requests first (earliest deadline first), then closed ones
        .sort((a, b) => Number(isClosed(a.status)) - Number(isClosed(b.status)))
        .map((r) => (
          <article
            className="panel"
            style={{ marginBottom: 15 }}
            key={r.id}
            data-testid="admin-report"
          >
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <strong>
                {r.ticket_no} · {reportKinds[r.kind]}
              </strong>
              <span className="badge">{reportStatuses[r.status]}</span>
            </div>
            <p style={{ fontSize: 13 }}>
              대상 <a href={`/creators/${r.creator_id}`}>{r.creator_id}</a> ·
              요청자 {r.reporter_id.slice(0, 8)}
              {r.identity_verified ? " (프로필 소유자 본인)" : ""} · 기한{" "}
              <span
                className={
                  ["pending", "in_review"].includes(r.status) &&
                  new Date(r.due_at) < now
                    ? "error"
                    : undefined
                }
              >
                {new Date(r.due_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}
              </span>
              {r.interim_hidden && " · 임시 비공개 중"}
              {r.parent_id && " · 재심(원 처리자 외 관리자 처리)"}
              {(signal.get(r.creator_id) ?? 0) >= 2 &&
                ` · 신고 누적 ${signal.get(r.creator_id)}명(30일, 검토 신호)`}
            </p>
            <p>{r.reason}</p>
            {r.source_url && (
              <a href={r.source_url} target="_blank" rel="noopener noreferrer">
                출처 확인 ↗
              </a>
            )}
            {r.response && <p className="notice">답변: {r.response}</p>}
            <AdminReview
              id={r.id}
              status={r.status}
              hidden={r.interim_hidden}
            />
            {ownerOf.has(r.creator_id) &&
              ["report", "impersonation"].includes(r.kind) &&
              ["in_review", "resolved"].includes(r.status) && (
                <AdminRestrict reportId={r.id} />
              )}
          </article>
        ))}
      {!reports?.length && (
        <p className="empty">검토 대기 중인 신고가 없습니다.</p>
      )}
      <h2>연락 제한 (기한부)</h2>
      {restrictions?.length ? (
        restrictions.map((x) => (
          <article
            className="panel"
            key={x.id}
            style={{ marginBottom: 15 }}
            data-testid="admin-restriction"
          >
            <p style={{ fontSize: 13 }}>
              계정 {x.user_id.slice(0, 8)} · 해제 예정{" "}
              {new Date(x.ends_at).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}
              {new Date(x.ends_at) < now && " (만료)"}
            </p>
            <p>사유: {x.reason}</p>
            {x.appeal && <p className="notice">이의신청: {x.appeal}</p>}
            <LiftRestriction restrictionId={x.id} />
          </article>
        ))
      ) : (
        <p className="empty">적용 중인 연락 제한이 없습니다.</p>
      )}
      <h2>프로필 소유 확인 요청</h2>
      {claims?.map((cl) => (
        <article className="panel" style={{ marginBottom: 15 }} key={cl.id}>
          <p>
            <a href={`/creators/${cl.creator_id}`}>{cl.creator_id}</a> · 청구자{" "}
            {cl.claimant_id.slice(0, 8)} · 만료{" "}
            {new Date(cl.expires_at).toLocaleString("ko-KR")}
          </p>
          <p style={{ fontSize: 13 }}>
            청구 대상 채널의 소개란에서 ADME 확인 코드를 직접 확인해 입력한 뒤
            승인하세요. 서버는 해시만 비교하며 코드 원문을 저장하지 않습니다.
          </p>
          <ClaimReview claimId={cl.id} />
        </article>
      ))}
      {!claims?.length && (
        <p className="empty">대기 중인 소유 확인 요청이 없습니다.</p>
      )}
      <h2>프로필 공개·데이터 관리</h2>
      <details>
        <summary>프로필 목록 ({creatorRows?.length ?? 0})</summary>
        {creatorRows?.map((r) => (
          <div className="result" key={r.id}>
            <span>↗</span>
            <div>
              {r.profile.name}
              <p>
                {r.profile.is_demo ? "DEMO" : "본인 등록"} ·{" "}
                {r.published ? "공개" : "비공개"}
              </p>
            </div>
            <div>
              <Moderate kind="creator" id={r.id} published={r.published} />
            </div>
          </div>
        ))}
      </details>
      <h2 style={{ marginTop: 35 }}>캠페인 운영</h2>
      <details>
        <summary>캠페인 목록 ({campaignRows?.length ?? 0})</summary>
        {campaignRows?.map((r) => (
          <div className="result" key={r.id}>
            <span>↗</span>
            <div>
              {r.brief.title}
              <p>{r.status}</p>
            </div>
            {r.status !== "closed" && (
              <div>
                <Moderate kind="campaign" id={r.id} published={true} />
              </div>
            )}
          </div>
        ))}
      </details>
      <h2 style={{ marginTop: 35 }}>이용권·HOT 운영</h2>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        TEST 결제 전용입니다. 만료·차감은 DB 서버 시각으로 판정하며 무료 베타
        권한과 무관합니다. 크레딧은 예약→확정/해제로만 차감되고 원장에
        기록됩니다.
      </p>
      {passes?.length ? (
        passes.map((p) => (
          <div
            key={p.id}
            className="inline"
            data-testid="admin-entitlement"
            style={{ fontSize: 13 }}
          >
            <span>
              {(p.profiles as unknown as { name: string } | null)?.name} ·{" "}
              {p.sku} ·{" "}
              <strong>
                {p.revoked_at
                  ? "회수됨"
                  : new Date(p.expires_at) > new Date()
                    ? "유효"
                    : "만료"}
              </strong>{" "}
              · 만료일 {p.expires_at.slice(0, 10)} · 크레딧 {p.credits} ·{" "}
              {p.grant_reason === "admin_grant"
                ? `수동 발급: ${p.grant_note}`
                : "결제"}
              {p.revoke_reason && ` · 회수 사유: ${p.revoke_reason}`}
            </span>
            {!p.revoked_at && <RevokeEntitlement id={p.id} />}
          </div>
        ))
      ) : (
        <p>
          활성화된 이용권이 없습니다. 미결제 주문에 권한을 수동 부여하지
          않습니다.
        </p>
      )}
      <details style={{ margin: "16px 0 32px" }}>
        <summary>이용권 수동 발급 (사유 필수)</summary>
        <GrantEntitlement
          members={members ?? []}
          skus={(skuRows ?? []).map((x) => x.sku)}
        />
      </details>
      <h2>회원 관리</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>역할</th>
              <th>가입일</th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role}</td>
                <td>{m.created_at.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 style={{ marginTop: 40 }}>TEST 결제 상태</h2>
      {payments?.map((p) => (
        <p key={p.id}>
          {p.sku} · {p.amount.toLocaleString()}원 · {p.status}
        </p>
      ))}
      {!payments?.length && <p>결제 내역이 없습니다.</p>}
      <h2 style={{ marginTop: 40 }}>운영 지표</h2>
      <nav
        className="inline"
        aria-label="집계 기간"
        data-testid="metric-period"
      >
        {[7, 30, 90].map((d) => (
          <Link
            key={d}
            href={`/admin?days=${d}`}
            className={d === days ? "badge lime" : "badge"}
            aria-current={d === days ? "page" : undefined}
          >
            최근 {d}일
          </Link>
        ))}
      </nav>
      {metrics ? (
        <>
          <table className="data-table" data-testid="ops-metrics">
            <thead>
              <tr>
                <th>지표</th>
                <th>값</th>
                <th>정의</th>
              </tr>
            </thead>
            <tbody>
              {METRIC_ROWS.map(([label, get, def]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td data-metric={label}>{get(metrics) ?? "-"}</td>
                  <td style={{ fontSize: 12 }}>{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            기간:{" "}
            {new Date(metrics.period.from).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            ~{" "}
            {new Date(metrics.period.to).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            (KST, 조회 시점 기준 최근 {metrics.period.days}일). 제외: 테스트
            계정 {metrics.excluded.test_accounts}개(예약 테스트 도메인 이메일 —
            example.com·.test 등), DEMO 캠페인 {metrics.excluded.demo_campaigns}
            개와 그에 연결된 활동. 개인 식별 정보 없이 건수만 집계합니다.
          </p>
          {metrics.errors.top.length > 0 && (
            <p style={{ fontSize: 13 }} data-testid="error-top">
              오류 상위 경로:{" "}
              {metrics.errors.top
                .map((e) => `${e.route} (${e.kind}) ${e.n}건`)
                .join(" · ")}
            </p>
          )}
        </>
      ) : (
        <p>지표를 불러오지 못했습니다.</p>
      )}
      <h2 style={{ marginTop: 40 }}>문의 처리</h2>
      {!inquiries?.length && <p>처리할 문의가 없습니다.</p>}
      {inquiries?.map((q) => (
        <article
          key={q.id}
          className="panel"
          style={{ marginBottom: 12 }}
          data-testid="admin-inquiry"
        >
          <span className="badge">
            {q.status === "open" ? "답변 대기" : "답변 완료"}
          </span>{" "}
          <span style={{ fontSize: 13 }}>
            {inquiryCategories[q.category as keyof typeof inquiryCategories]} ·{" "}
            {new Date(q.created_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            ·{" "}
            {q.user_id
              ? "회원(답변은 도움말 화면에 표시)"
              : `비회원 — 이메일로 직접 답변: ${q.reply_email}`}
          </span>
          <p style={{ whiteSpace: "pre-wrap" }}>{q.message}</p>
          <AnswerInquiry id={q.id} />
        </article>
      ))}
      <h2 style={{ marginTop: 40 }}>활성화 퍼널 (최근 30일)</h2>
      <table className="data-table" data-testid="funnel">
        <thead>
          <tr>
            <th>단계</th>
            <th>가명 사용자 수</th>
            <th>이전 단계 대비</th>
          </tr>
        </thead>
        <tbody>
          {conversion(funnel ?? {}).map((s) => (
            <tr key={s.event}>
              <td>{s.label}</td>
              <td>{s.n}</td>
              <td>{s.rate === null ? "-" : `${s.rate}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        가명 처리된 집계만 표시합니다. 이메일·검색어·메시지 원문은 수집하지
        않으며, 이벤트는 {EVENT_RETENTION_DAYS}일 뒤 삭제됩니다. 수집 거부한
        사용자는 제외됩니다.
      </p>
      <h2 style={{ marginTop: 40 }}>추천 피드백 (오프라인 평가)</h2>
      <p style={{ fontSize: 13 }} data-testid="feedback-eval">
        전체 라벨 {fb.length}건 · 평가(test) 세트 {fbEval.labels}건 · 캠페인{" "}
        {fbEval.campaigns}개 · scorer {fbVersion}
        <br />
        <strong>{fbEval.statement}</strong>
        {fbEval.sufficient && (
          <>
            <br />
            상위 3 적합률 {fbEval.precision_at_k ?? "-"}% · 상위 3 수락률{" "}
            {fbEval.accept_rate_at_k ?? "-"}%
            {fbEval.size_bias_flag &&
              " · 팔로워 규모별 적합률 차이 20%p 이상 — 편향 검토 필요"}
          </>
        )}
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        캠페인 단위로 학습/평가를 나눠 같은 브리프가 양쪽에 섞이지 않습니다.
        &lsquo;적합&rsquo; 클릭 수는 모델 성능의 증거가 아닙니다.
      </p>
      <h2 style={{ marginTop: 40 }}>알림 메일 outbox</h2>
      <p style={{ fontSize: 13 }} data-testid="outbox">
        대기 {ob.queued ?? 0} · 재시도 대기 {ob.failed ?? 0} · 발송 중{" "}
        {ob.sending ?? 0} · 실패 확정 {ob.dead ?? 0} · 발송 완료 {ob.sent ?? 0}{" "}
        · 취소 {ob.cancelled ?? 0}
        <br />
        <strong>
          {configuredSender()
            ? "발송 공급자 연결됨"
            : "발송 공급자 미설정 — 실제 메일은 발송되지 않습니다."}
        </strong>
      </p>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        회원가입 확인·비밀번호 재설정 메일은 Supabase Auth SMTP 설정으로 별도
        발송되며 이 outbox와 무관합니다.
      </p>
      <h2 style={{ marginTop: 40 }}>서비스 상태</h2>
      <p style={{ fontSize: 13 }} data-testid="health-status">
        DB {health.status === "ok" ? "정상" : "장애"} · 응답 {health.db.ms}ms ·
        모드 {health.mode} · 마이그레이션 {health.stats?.migration ?? "-"} ·
        알림 수신 {health.configured.alert_webhook ? "설정됨" : "미설정"}
      </p>
      {health.usage.map((u) => (
        <p
          key={u.key}
          style={{ fontSize: 13 }}
          className={u.warn ? "notice" : undefined}
          data-testid="usage"
        >
          {u.label} 기준 {Math.round(u.ratio * 1000) / 10}% 사용
          {u.warn && " — 한도 80% 이상, 정리 또는 요금제 검토 필요"}
        </p>
      ))}
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        한도는 무료 요금제 참고값입니다. 실제 한도는 각 서비스 콘솔에서
        확인하세요.
      </p>
      <h2 style={{ marginTop: 40 }}>데이터 보존·삭제</h2>
      <p style={{ fontSize: 13 }}>
        삭제 표시(tombstone) {tombstones ?? 0}건 · 백업을 복구한 뒤에는 반드시
        &lsquo;복구 후 삭제 재적용&rsquo;을 실행하세요.
      </p>
      <RetentionControls />
      {runs?.map((r) => (
        <p key={r.id} style={{ fontSize: 13 }} data-testid="retention-run">
          {new Date(r.started_at).toLocaleString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}{" "}
          · {r.status === "ok" ? "완료" : `실패(${r.error})`} · 삭제{" "}
          {Object.values((r.counts ?? {}) as Record<string, number>).reduce(
            (x, y) => x + y,
            0,
          )}
          건
        </p>
      ))}
      {!runs?.length && <p className="empty">보존 작업 기록이 없습니다.</p>}
      <h2 style={{ marginTop: 40 }}>최근 감사 기록</h2>
      {audit?.map((a) => (
        <p key={a.id} style={{ fontSize: 13 }}>
          {a.created_at} · {a.action} · {a.entity_id}
        </p>
      ))}
    </section>
  );
}
