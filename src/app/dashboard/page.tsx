import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { logout } from "@/app/actions";
import { DealControls, ReadButton } from "@/components/deal-controls";
import { Conversation } from "@/components/conversation";
import { canTransition } from "@/lib/schemas";
export default async function Dashboard() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const db = await supabase();
  const [
    { data: profile },
    { data: campaigns },
    { data: proposals },
    { data: orders },
    { data: entitlements },
    { data: saved },
  ] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db
      .from("campaigns")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("proposals")
      .select("*")
      .or(`brand_id.eq.${user.id},creator_user_id.eq.${user.id}`)
      .order("created_at", { ascending: false }),
    db
      .from("orders")
      .select("id,sku,amount,status,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false }),
    db
      .from("entitlements")
      .select("*")
      .eq("owner_id", user.id)
      .gt("expires_at", new Date().toISOString()),
    db.from("saved_creators").select("creator_id").eq("owner_id", user.id),
  ]);
  const status: Record<string, string> = {
    pending: "응답 대기",
    accepted: "협업 진행",
    rejected: "거절",
    submitted: "검토 대기",
    revision_requested: "수정 요청",
    completed: "완료",
  };
  return (
    <section className="wrap">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your workspace / {profile?.role}</span>
          <h1 className="page-title">{profile?.name}님의 다음 협업.</h1>
          <p>발견한 가능성을 함께 만드는 일로.</p>
        </div>
        <div className="inline">
          <Link className="button outline small" href="/settings">
            프로필 설정
          </Link>
          {profile?.role === "admin" && (
            <Link className="button outline small" href="/admin">
              운영 관리
            </Link>
          )}
          <form action={logout}>
            <button className="button outline small">로그아웃</button>
          </form>
        </div>
      </div>
      <div className="metric-row">
        <div>
          <strong>{campaigns?.length ?? 0}</strong>
          <span>내 캠페인</span>
        </div>
        <div>
          <strong>{proposals?.length ?? 0}</strong>
          <span>협업·지원</span>
        </div>
        <div>
          <strong>{entitlements?.length ?? 0}</strong>
          <span>유효 이용권</span>
        </div>
        <div>
          <strong>{saved?.length ?? 0}</strong>
          <span>저장한 후보</span>
        </div>
      </div>
      <div className="section-heading">
        <h2>내 캠페인</h2>
        {profile?.role === "brand" && (
          <Link href="/campaigns/new" className="button primary">
            캠페인 만들기 ↗
          </Link>
        )}
      </div>
      {campaigns?.length ? (
        campaigns.map((c) => (
          <Link href={`/campaigns/${c.id}`} className="result" key={c.id}>
            <span>↗</span>
            <div>
              <h3>{c.brief.title}</h3>
              <p>
                {c.brief.category} · {c.status}
              </p>
            </div>
            <span>{Number(c.brief.budget_krw).toLocaleString()}원</span>
          </Link>
        ))
      ) : (
        <p className="notice">
          등록한 캠페인이 없습니다.{" "}
          {profile?.role === "creator"
            ? "공개 캠페인을 찾아 지원해보세요."
            : "첫 캠페인의 브리프를 작성해보세요."}
        </p>
      )}
      <h2 style={{ marginTop: 55 }}>협업 파이프라인</h2>
      {proposals?.length ? (
        proposals.map((p) => (
          <article className="panel" style={{ marginBottom: 20 }} key={p.id}>
            <span className="badge lime">{status[p.status]}</span>
            <ReadButton proposalId={p.id} />
            <h3 style={{ marginTop: 18 }}>
              {p.kind === "application" ? "캠페인 지원" : "브랜드 제안"}
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{p.brief}</p>
            <Link href={`/campaigns/${p.campaign_id}`} className="muted">
              캠페인 보기 ↗
            </Link>
            <div style={{ marginTop: 22 }}>
              <DealControls
                id={p.id}
                actions={[
                  "accepted",
                  "rejected",
                  "submitted",
                  "completed",
                  "revision_requested",
                ].filter((a) =>
                  canTransition(
                    p.kind,
                    p.status,
                    a,
                    p.brand_id === user.id ? "brand" : "creator",
                  ),
                )}
              />
            </div>
            <Conversation
              proposalId={p.id}
              viewerId={user.id}
              writable={p.status !== "rejected"}
              deliverable={
                p.creator_user_id === user.id &&
                ["accepted", "revision_requested"].includes(p.status)
              }
            />
          </article>
        ))
      ) : (
        <div className="empty">아직 협업 제안이 없습니다.</div>
      )}
      <h2 style={{ marginTop: 45 }}>저장한 크리에이터</h2>
      <a href="/api/export" className="button outline small">
        후보 CSV 내보내기
      </a>
      <div className="inline">
        {saved?.length ? (
          saved.map((s) => (
            <Link
              className="button outline"
              key={s.creator_id}
              href={`/creators/${s.creator_id}`}
            >
              {s.creator_id} ↗
            </Link>
          ))
        ) : (
          <p>탐색에서 관심 있는 후보를 저장해보세요.</p>
        )}
      </div>
      <h2 style={{ marginTop: 45 }}>이용권·결제 내역</h2>
      {entitlements?.map((e) => (
        <p className="notice" key={e.id}>
          {e.sku} ·{" "}
          {new Date(e.expires_at).toLocaleDateString("ko-KR", {
            timeZone: "Asia/Seoul",
          })}{" "}
          만료 · 잔여 크레딧 {e.credits}
        </p>
      ))}
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>상품</th>
              <th>TEST 금액</th>
              <th>상태</th>
              <th>주문일</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id}>
                <td>{o.sku}</td>
                <td>{o.amount.toLocaleString()}원</td>
                <td>{o.status}</td>
                <td>
                  {new Date(o.created_at).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders?.length && <p className="empty">결제 내역이 없습니다.</p>}
      </div>
    </section>
  );
}
