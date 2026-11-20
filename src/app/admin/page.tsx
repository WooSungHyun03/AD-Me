import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { Moderate } from "@/components/moderate";
import { AdminReview } from "@/components/admin-review";
import { hasRecentAdminMfa } from "@/lib/admin-security";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "admin") {
    const { data: role } = await c.db.rpc("ops_enrollment_role");
    if (role) redirect("/admin/intelligence");
    return (
      <section className="wrap">
        <h1 className="page-title">관리자 권한이 필요합니다.</h1>
        <p>운영 데이터는 허가된 관리자에게만 공개됩니다.</p>
      </section>
    );
  }
  const { data: claims, error: claimsError } = await c.db.auth.getClaims();
  const { data: allowed, error: adminError } = await c.db.rpc("is_admin");
  if (
    claimsError ||
    claims?.claims.sub !== c.user.id ||
    !hasRecentAdminMfa(claims?.claims) ||
    adminError ||
    allowed !== true
  )
    redirect("/admin/security");
  const [{ data: creatorRows }, { data: campaignRows }, { data: passes }] =
    await Promise.all([
      c.db
        .from("creators")
        .select("id,profile,published,moderation_status")
        .limit(100),
      c.db
        .from("campaigns")
        .select("id,brief,status,moderation_status")
        .limit(100),
      c.db
        .from("entitlements")
        .select("id,sku,expires_at,credits")
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
  ] = await Promise.all([
    c.db.from("profiles").select("id,name,role,created_at"),
    c.db.from("reports").select("*").order("created_at", { ascending: false }),
    c.db.from("orders").select("id,sku,amount,status"),
    c.db
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30),
    c.db.from("campaigns").select("id", { count: "exact", head: true }),
    c.db.from("creators").select("id", { count: "exact", head: true }),
  ]);
  return (
    <section className="wrap">
      <Link className="button outline small" href="/admin/reviews">
        근거 검토함 ↗
      </Link>
      <span className="eyebrow">Operations / admin only</span>
      <h1 className="page-title">서비스 운영 현황.</h1>
      <Link href="/admin/intelligence" className="button outline">
        수집·AI 운영 콘솔
      </Link>
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
            {reports?.filter((r) => r.status === "pending").length ?? 0}
          </strong>
          <span>이전 접수 신고 미처리</span>
        </div>
      </div>
      <h2>이전 접수 신고·데이터 검토</h2>
      {reports?.map((r) => (
        <article className="panel" style={{ marginBottom: 15 }} key={r.id}>
          <span className="badge">{r.status}</span>
          <p>{r.reason}</p>
          <a href={r.source_url} target="_blank" rel="noopener noreferrer">
            출처 확인 ↗
          </a>
          <AdminReview id={r.id} />
        </article>
      ))}
      {!reports?.length && (
        <p className="empty">이전 접수 기록 중 검토 대기 신고가 없습니다. 새 제출 자료는 근거 검토함에서 확인해주세요.</p>
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
              <Moderate
                kind="creator"
                id={r.id}
                restricted={r.moderation_status === "restricted"}
              />
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
            <div>
              <Moderate
                kind="campaign"
                id={r.id}
                restricted={r.moderation_status === "restricted"}
              />
            </div>
          </div>
        ))}
      </details>
      <h2 style={{ marginTop: 35 }}>이용권·HOT 운영</h2>
      {passes?.length ? (
        passes.map((p) => (
          <p key={p.id}>
            {p.sku} · {new Date(p.expires_at) > new Date() ? "유효" : "만료"} ·
            만료일 {p.expires_at.slice(0, 10)} · 크레딧 {p.credits}
          </p>
        ))
      ) : (
        <p>
          활성화된 이용권이 없습니다. 미결제 주문에 권한을 수동 부여하지
          않습니다.
        </p>
      )}
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
      <h2 style={{ marginTop: 40 }}>최근 감사 기록</h2>
      {audit?.map((a) => (
        <p key={a.id} style={{ fontSize: 13 }}>
          {a.created_at} · {a.action} · {a.entity_id}
        </p>
      ))}
    </section>
  );
}
