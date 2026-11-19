import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { AdminReview } from "@/components/admin-review";
export default async function Admin() {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "admin")
    return (
      <section className="wrap">
        <h1 className="page-title">관리자 권한이 필요합니다.</h1>
        <p>운영 데이터는 허가된 관리자에게만 공개됩니다.</p>
      </section>
    );
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
            {reports?.filter((r) => r.status === "pending").length ?? 0}
          </strong>
          <span>미처리 신고</span>
        </div>
      </div>
      <h2>신고·데이터 검토</h2>
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
        <p className="empty">검토 대기 중인 신고가 없습니다.</p>
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
