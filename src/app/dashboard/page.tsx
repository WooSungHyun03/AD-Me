import { CancelOrder } from "@/components/cancel-order";
import { LiveMessages, ChatSafety } from "@/components/live-chat";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { featuredYoutube } from "@/lib/featured-youtube";
import { logout } from "@/app/actions";
import { DealControls, MessageForm, ReadButton } from "@/components/deal-controls";
import { NotificationBadge } from "@/components/notifications";
import { loadNotifications } from "@/lib/notifications";
import { canTransition } from "@/lib/schemas";
import { onboardingSteps } from "@/lib/onboarding";
import { BlockButton, RestrictionAppeal } from "@/components/safety";
import {
  inStage,
  isStage,
  STAGES,
  STATUS_LABEL,
  summarize,
  type Stage,
} from "@/lib/pipeline";
const ORDER_STATUS: Record<string, string> = {
  pending: "TEST 결제 대기",
  paid: "TEST 결제 완료",
  failed: "TEST 결제 실패",
  cancelled: "TEST 취소·회수됨",
};
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage: rawStage } = await searchParams;
  const stage = isStage(rawStage) ? rawStage : undefined;
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const db = await supabase();
  const [
    { data: profile },
    { data: campaigns },
    { data: proposals },
    { data: orders },
    { data: entitlements },
    { data: saved },
    { data: creatorProfile },
    { data: impressions },
    { data: savedChannels, error: savedChannelsError },
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
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    db
      .from("saved_list_items")
      .select("creator_id,creators(profile),saved_lists!inner(is_default)")
      .eq("owner_id", user.id)
      .eq("saved_lists.is_default", true),
    db
      .from("creators")
      .select("published")
      .eq("owner_id", user.id)
      .maybeSingle(),
    // D070: own HOT exposure history (RLS: owner only).
    db
      .from("promotion_impressions")
      .select("day,n,entitlements!inner(sku,starts_at,expires_at,revoked_at)")
      .order("day", { ascending: false })
      .limit(14),
    db
      .from("saved_youtube_channels")
      .select("channel_id")
      .eq("owner_id", user.id),
  ]);
  const [{ data: blocks }, { data: restrictions }] = await Promise.all([
    db.rpc("my_blocks"),
    db
      .from("contact_restrictions")
      .select("id,reason,ends_at,appeal,lifted_at")
      .eq("user_id", user.id)
      .is("lifted_at", null)
      .gt("ends_at", new Date().toISOString()),
  ]);
  const blocked = new Set(
    (blocks ?? []).map((b: { blocked_id: string }) => b.blocked_id),
  );
  const steps = onboardingSteps({
    role: profile?.role,
    name: profile?.name,
    campaigns: campaigns?.length ?? 0,
    creatorProfile,
  });
  const done = steps.filter((s) => s.done).length;
  const [{ data: messages }, { data: reads }] = await Promise.all([
    db.from("messages").select("*").order("created_at", { ascending: true }),
    db
      .from("proposal_reads")
      .select("proposal_id,last_read_at")
      .eq("user_id", user.id),
  ]);
  const publicChannels = savedChannels?.length
    ? await featuredYoutube("", null, 50)
    : null;
  const directory = new Map(
    publicChannels?.items.map((channel) => [channel.channel_id, channel.title]),
  );
  const lastRead = new Map(
    reads?.map((row) => [row.proposal_id, Date.parse(row.last_read_at)]),
  );
  const unread = new Map<string, number>();
  for (const row of messages ?? []) {
    if (
      row.sender_id !== user.id &&
      Date.parse(row.created_at) > (lastRead.get(row.proposal_id) ?? 0)
    ) {
      unread.set(row.proposal_id, (unread.get(row.proposal_id) ?? 0) + 1);
    }
  }
  const { data: events } = await db
    .from("proposal_events")
    .select("id,proposal_id,actor_id,to_status,created_at")
    .order("id", { ascending: true });
  const notes = await loadNotifications(db, 200).catch(() => null);
  const unreadBy = new Map<string, number>();
  for (const n of notes?.items ?? [])
    if (n.id > notes!.lastReadId)
      unreadBy.set(n.proposal_id, (unreadBy.get(n.proposal_id) ?? 0) + 1);
  const status = STATUS_LABEL;
  // Counts and the list below use the same rows and the same stage rule (D056).
  const counts = summarize(proposals ?? []);
  const shown = inStage(proposals ?? [], stage);
  return (
    <section className="wrap">
      <LiveMessages />
      <div className="section-heading">
        <div>
          <span className="eyebrow">Your workspace / {profile?.role}</span>
          <h1 className="page-title">{profile?.name}님의 다음 협업.</h1>
          <p>발견한 가능성을 함께 만드는 일로.</p>
        </div>
        <div className="inline">
          <NotificationBadge userId={user.id} initial={notes?.unread ?? 0} />
          <Link className="button outline small" href="/reports">
            내 요청
          </Link>
          <Link className="button outline small" href="/settings">
            프로필 설정
          </Link>
          {profile?.role === "brand" && (
            <Link className="button outline small" href="/brand/products">
              광고 상품
            </Link>
          )}
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
      {done < steps.length && (
        <div className="notice" style={{ marginBottom: 30 }}>
          <strong>
            시작하기 {done}/{steps.length}
          </strong>
          <ul style={{ margin: "10px 0 0", paddingLeft: 18 }}>
            {steps.map((s) => (
              <li key={s.label}>
                {s.done ? (
                  <span>✓ {s.label}</span>
                ) : (
                  <Link href={s.href}>{s.label} 이어서 하기 →</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {restrictions?.map((r) => (
        <div
          className="notice"
          role="status"
          key={r.id}
          data-testid="restriction"
        >
          <strong>
            운영 검토로 새 제안·메시지 보내기가 일시 제한되었습니다.
          </strong>
          <p>
            사유: {r.reason} · 해제 예정{" "}
            {new Date(r.ends_at).toLocaleString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}
          </p>
          {r.appeal ? (
            <p>이의신청 접수됨 — 운영자가 검토 중입니다.</p>
          ) : (
            <RestrictionAppeal restrictionId={r.id} />
          )}
        </div>
      ))}
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
      <div className="section-heading" style={{ marginTop: 55 }}>
        <h2>협업 파이프라인</h2>
        <a
          className="button outline small"
          href={`/api/export?type=pipeline${stage ? `&stage=${stage}` : ""}`}
        >
          결과 CSV 내보내기
        </a>
      </div>
      <nav className="tags" aria-label="파이프라인 단계" data-testid="stages">
        <Link
          className="badge"
          href="/dashboard"
          aria-current={stage ? undefined : "page"}
        >
          전체 {proposals?.length ?? 0}
        </Link>
        {(Object.keys(STAGES) as Stage[]).map((k) => (
          <Link
            key={k}
            className={k === stage ? "badge lime" : "badge"}
            href={`/dashboard?stage=${k}`}
            aria-current={k === stage ? "page" : undefined}
            data-stage={k}
          >
            {STAGES[k].label}
            <strong style={{ marginLeft: 4 }}>{counts[k]}</strong>
          </Link>
        ))}
      </nav>
      <p style={{ fontSize: 12, color: "var(--muted)" }}>
        상태 변경 기록과 제출된 결과물만 집계합니다. 노출·전환·매출은 추정하지
        않습니다.
      </p>
      {shown.length ? (
        shown.map((p) => (
          <article
            className="panel"
            style={{ marginBottom: 20 }}
            key={p.id}
            data-proposal-id={p.id}
            id={`proposal-${p.id}`}
          >
            <span className="badge lime">{status[p.status]}</span>
            {(unreadBy.get(p.id) ?? 0) > 0 && (
              <span className="badge">새 알림 {unreadBy.get(p.id)}</span>
            )}
            <ReadButton proposalId={p.id} unread={unread.get(p.id) ?? 0} />
            <h3 style={{ marginTop: 18 }}>
              {p.kind === "application" ? "캠페인 지원" : "브랜드 제안"}
            </h3>
            <p style={{ whiteSpace: "pre-wrap" }}>{p.brief}</p>
            <Link href={`/campaigns/${p.campaign_id}`} className="muted">
              캠페인 보기 ↗
            </Link>
            {" · "}
            <Link href={`/creators/${p.creator_id}`}>크리에이터 프로필 ↗</Link>
            <div style={{ marginTop: 22 }}>
              <DealControls
                id={p.id}
                actions={[
                  "accepted",
                  "rejected",
                  "cancelled",
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
            <ol className="muted" style={{ fontSize: 13, marginTop: 16 }}>
              {events
                ?.filter((e) => e.proposal_id === p.id)
                .map((e) => (
                  <li key={e.id} data-testid="proposal-event">
                    {new Date(e.created_at).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}{" "}
                    · {status[e.to_status] ?? e.to_status} ·{" "}
                    {e.actor_id === null
                      ? "기존 기록"
                      : e.actor_id === user.id
                        ? "나"
                        : "상대"}
                  </li>
                ))}
            </ol>
            <details data-live-chat style={{ marginTop: 24 }}>
              <summary>
                메시지·결과물 (
                {messages?.filter((m) => m.proposal_id === p.id).length ?? 0})
              </summary>
              {messages
                ?.filter((m) => m.proposal_id === p.id)
                .map((m) => (
                  <div className="notice" key={m.id}>
                    <strong>
                      {m.sender_id === user.id ? "나" : "협업 파트너"} ·{" "}
                      {m.kind === "deliverable" ? "결과물" : "메시지"}
                    </strong>
                    <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                      {m.body}
                    </p>
                    {m.url && (
                      <a href={m.url} target="_blank" rel="noopener noreferrer">
                        결과물 열기 ↗
                      </a>
                    )}
                  </div>
                ))}
              {!["rejected", "cancelled"].includes(p.status) &&
                !blocked.has(
                  p.brand_id === user.id ? p.creator_user_id : p.brand_id,
                ) && (
                  <MessageForm
                    proposalId={p.id}
                    deliverable={
                      p.creator_user_id === user.id &&
                      ["accepted", "revision_requested"].includes(p.status)
                    }
                  />
                )}
              <ChatSafety id={p.id} />
            </details>
            {blocked.has(
              p.brand_id === user.id ? p.creator_user_id : p.brand_id,
            ) ? (
              <p className="muted">
                차단한 상대입니다. 설정에서 해제할 수 있습니다.
              </p>
            ) : (
              <BlockButton proposalId={p.id} />
            )}
          </article>
        ))
      ) : (
        <div className="empty">
          {stage
            ? `${STAGES[stage].label} 단계의 협업이 없습니다.`
            : "아직 협업 제안이 없습니다."}
        </div>
      )}
      <h2 style={{ marginTop: 45 }}>저장한 크리에이터</h2>
      <a href="/api/export" className="button outline small">
        후보 CSV 내보내기
      </a>{" "}
      <Link href="/lists" className="button outline small">
        후보 그룹 관리 →
      </Link>
      <div className="inline">
        {savedChannelsError || publicChannels?.unavailable ? (
          <p role="alert">저장한 YouTube 채널을 불러오지 못했습니다.</p>
        ) : null}
        {savedChannels?.map(({ channel_id }) =>
          directory.has(channel_id) ? (
            <Link
              className="button outline"
              key={channel_id}
              href={`/creators/youtube/${channel_id}`}
            >
              {directory.get(channel_id)} ↗
            </Link>
          ) : null,
        )}
        {saved?.length
          ? saved.map((s) => (
              <Link
                className="button outline"
                key={s.creator_id}
                href={`/creators/${s.creator_id}`}
              >
                {s.creator_id} ↗
              </Link>
            ))
          : !savedChannels?.some(({ channel_id }) =>
              directory.has(channel_id),
            ) && <p>탐색에서 관심 있는 후보를 저장해보세요.</p>}
      </div>
      <h2 style={{ marginTop: 45 }}>이용권·결제 내역</h2>
      {!!impressions?.length && (
        <div
          className="panel"
          style={{ marginBottom: 16 }}
          data-testid="hot-history"
        >
          <strong>HOT 광고 노출 이력 (TEST)</strong>
          <p style={{ fontSize: 13 }}>
            내 프로필의 광고 슬롯 노출 횟수(서버 렌더 기준, 일별)입니다. 일반
            검색·추천 순위에는 반영되지 않습니다.
          </p>
          {impressions.map((r) => {
            const e = r.entitlements as unknown as {
              starts_at: string;
              expires_at: string;
              revoked_at: string | null;
            };
            const d = (x: string) =>
              new Date(x).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
              });
            return (
              <p key={`${r.day}-${e.starts_at}`} style={{ fontSize: 13 }}>
                {r.day} · {r.n}회 노출 · 광고 기간 {d(e.starts_at)} ~{" "}
                {d(e.expires_at)}
                {e.revoked_at ? " (회수됨)" : ""}
              </p>
            );
          })}
        </div>
      )}
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
              <th>취소</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((o) => (
              <tr key={o.id}>
                <td>{o.sku}</td>
                <td>{o.amount.toLocaleString()}원</td>
                <td>{ORDER_STATUS[o.status] ?? o.status}</td>
                <td>
                  {new Date(o.created_at).toLocaleDateString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </td>
                <td>{o.status === "paid" && <CancelOrder orderId={o.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!orders?.length && <p className="empty">결제 내역이 없습니다.</p>}
      </div>
    </section>
  );
}
