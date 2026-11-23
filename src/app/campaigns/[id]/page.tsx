import Link from "next/link";
import { notFound } from "next/navigation";
import { campaigns, rank, type Brief } from "@/lib/catalog";
import { configured, supabase, currentUser } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
import { isDemoMode } from "@/lib/mode";
import { ProposalForm } from "@/components/proposal-form";
import { RemoveItem, ShortlistButton } from "@/components/lists";
import { MatchFeedback } from "@/components/match-feedback";
import { ChecklistEditor, ReviewForm } from "@/components/selection-review";
import { SHOWN, type Verdict } from "@/lib/matching-eval";
export default async function Campaign({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const [{ id }, { creator }] = await Promise.all([params, searchParams]);
  let brief:
    | (Brief & {
        title: string;
        product: string;
        goal: string;
        target_audience: string;
      })
    | undefined = isDemoMode()
    ? campaigns.find((c) => c.seed_id === id)
    : undefined;
  let isDemo = true,
    ownerId: string | null = null,
    recruit: {
      status: string;
      until: string | null;
      capacity: number | null;
      selected: number | null;
      accepting: boolean;
    } | null = null;
  let people: { id: string; name: string }[] = [];
  let shortlist: { id: string; items: { id: string; name: string }[] } | null =
    null;
  let review: {
    items: { id: string; label: string }[];
    rows: {
      creator_id: string;
      checked: string[];
      memo: string;
      approved: boolean;
      reviewed_at: string | null;
    }[];
    applicants: { id: string; name: string }[];
  } | null = null;
  const user = await currentUser();
  if (configured()) {
    const db = await supabase();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data?.is_demo && !isDemoMode()) notFound();
    if (data) {
      brief = data.brief;
      isDemo = data.is_demo;
      ownerId = data.owner_id;
      // Counts need a session (RPCs are not granted to anon); the DB enforces the rules either way.
      const [sel, acc] = user
        ? await Promise.all([
            db.rpc("campaign_selected", { p_campaign: id }),
            db.rpc("campaign_accepting", { p_campaign: id }),
          ])
        : [{ data: null }, { data: null }];
      recruit = {
        status: data.status,
        until: data.recruit_until,
        capacity: data.capacity,
        selected: sel.data,
        accepting:
          acc.data ??
          (data.status === "published" &&
            (!data.recruit_until || new Date(data.recruit_until) > new Date())),
      };
    } else if (!id.startsWith("campaign-")) notFound();
    const { data: cs } = await db
      .from("creators")
      .select("id,profile,owner_id")
      .not("owner_id", "is", null)
      .eq("published", true);
    if (data && ownerId === user?.id) {
      // D061: brand-private review data (RLS: owner only).
      const [{ data: items }, { data: rows }, { data: apps }] =
        await Promise.all([
          db
            .from("review_checklist_items")
            .select("id,label")
            .order("created_at"),
          db
            .from("creator_reviews")
            .select("creator_id,checked,memo,approved,reviewed_at")
            .eq("campaign_id", id),
          db
            .from("proposals")
            .select("creator_id,creators(profile)")
            .eq("campaign_id", id)
            .eq("kind", "application")
            .eq("status", "pending"),
        ]);
      review = {
        items: items ?? [],
        rows: rows ?? [],
        applicants: (apps ?? []).map((a) => ({
          id: a.creator_id,
          name:
            (a.creators as unknown as { profile: { name: string } } | null)
              ?.profile.name ?? a.creator_id,
        })),
      };
      // RLS: only the owner's own campaign shortlist is visible.
      const { data: l } = await db
        .from("saved_lists")
        .select("id,saved_list_items(creator_id,creators(profile))")
        .eq("campaign_id", id)
        .maybeSingle();
      if (l)
        shortlist = {
          id: l.id,
          items: l.saved_list_items.map((i) => ({
            id: i.creator_id,
            name:
              (i.creators as unknown as { profile: { name: string } } | null)
                ?.profile.name ?? i.creator_id,
          })),
        };
    }
    people = (cs ?? [])
      .filter((c) => ownerId === user?.id || c.owner_id === user?.id)
      .map((c) => ({ id: c.id, name: c.profile.name }));
  }
  if (!brief) notFound();
  const catalog = await publicCreators();
  const results = rank(brief, catalog).slice(0, SHOWN);
  const rateable = !!user && ownerId === user.id && !isDemo;
  const feedback = rateable
    ? ((
        await (
          await supabase()
        )
          .from("matching_feedback")
          .select("creator_id,verdict,reason")
          .eq("campaign_id", id)
      ).data ?? [])
    : [];
  return (
    <section className="wrap">
      <Link href="/campaigns" className="muted">
        ← 캠페인 목록
      </Link>
      <div className="split" style={{ marginTop: 32 }}>
        <div>
          <span className="badge">
            {isDemo ? "가상 캠페인 · DEMO" : "캠페인 브리프"}
          </span>
          <h1 className="page-title">{brief.title}</h1>
          <p>
            {brief.product} · {brief.category}
          </p>
          <div className="metric-row">
            <div>
              <strong>{(brief.budget_krw / 10000).toLocaleString()}만원</strong>
              <span>총 예산</span>
            </div>
            {recruit && (
              <>
                <div>
                  <strong>
                    {recruit.until
                      ? new Date(recruit.until).toLocaleDateString("ko-KR", {
                          timeZone: "Asia/Seoul",
                        })
                      : "상시"}
                  </strong>
                  <span>모집 마감</span>
                </div>
                <div>
                  <strong>
                    {recruit.capacity
                      ? `${recruit.selected ?? "-"}/${recruit.capacity}명`
                      : "제한 없음"}
                  </strong>
                  <span>선정 인원</span>
                </div>
              </>
            )}
          </div>
          {recruit && !recruit.accepting && (
            <p className="notice">
              {recruit.status === "draft"
                ? "비공개 초안입니다."
                : "모집이 마감되었습니다. 새 지원은 받지 않습니다."}
            </p>
          )}
          {ownerId === user?.id && !isDemo && (
            <Link
              className="button outline small"
              href={`/campaigns/${id}/edit`}
            >
              캠페인 수정·모집 관리
            </Link>
          )}
          <h3>캠페인 목표</h3>
          <p>{brief.goal}</p>
          <h3>타깃 고객</h3>
          <p>{brief.target_audience}</p>
          <div className="tags">
            {brief.vibes.map((t) => (
              <span className="badge" key={t}>
                {t}
              </span>
            ))}
            <span className="badge">{brief.format}</span>
          </div>
        </div>
        <div>
          {ownerId === user?.id && !isDemo && (
            <section className="panel" style={{ marginBottom: 28 }}>
              <h3 style={{ marginTop: 0 }}>
                캠페인 후보 목록 ({shortlist?.items.length ?? 0})
              </h3>
              {shortlist?.items.length ? (
                shortlist.items.map((i) => (
                  <div className="result" key={i.id}>
                    <span>↗</span>
                    <Link href={`/creators/${i.id}`}>{i.name}</Link>
                    <RemoveItem
                      listId={shortlist!.id}
                      creatorId={i.id}
                      name={i.name}
                    />
                  </div>
                ))
              ) : (
                <p className="empty">
                  아래 추천에서 후보에 담아 비교·제안을 준비하세요.
                </p>
              )}
            </section>
          )}
          {ownerId === user?.id && !isDemo && review && (
            <section
              className="panel"
              style={{ marginBottom: 28 }}
              data-testid="selection-review"
            >
              <h3 style={{ marginTop: 0 }}>선정 검토 (비공개)</h3>
              <p style={{ fontSize: 13 }}>
                브랜드 내부 검토용입니다. 크리에이터·다른 브랜드·공개 프로필에
                표시되지 않으며 평판 정보로 쓰이지 않습니다.{" "}
                {review.items.length
                  ? "체크 항목이 있으면 모든 항목 확인과 승인 후에만 지원자를 선정(수락)할 수 있습니다."
                  : "체크 항목을 추가하면 선정 전 승인이 필수가 됩니다."}
              </p>
              <ChecklistEditor items={review.items} />
              {[
                ...new Map(
                  [...review.applicants, ...(shortlist?.items ?? [])].map(
                    (x) => [x.id, x],
                  ),
                ).values(),
              ].map((x) => (
                <ReviewForm
                  key={x.id}
                  campaignId={id}
                  creatorId={x.id}
                  name={x.name}
                  items={review!.items}
                  review={review!.rows.find((r) => r.creator_id === x.id)}
                />
              ))}
            </section>
          )}
          <h2>브랜드에 어울리는 발견.</h2>
          <p style={{ fontSize: 13 }}>
            추천 정책: 분야{" "}
            {brief.policy?.category === "hard" ? "필수" : "선호"} · 예산{" "}
            {brief.policy?.budget === "hard" ? "필수" : "선호"} · 정보 없음 시{" "}
            {brief.policy?.unknown === "exclude" ? "제외" : "보류"}. 협업 불가·
            플랫폼 불일치 크리에이터는 점수 계산 전에 제외됩니다.
          </p>
          <p>
            태그와 예산을 바탕으로 계산한 설명 가능한 추천입니다. HOT 유료
            노출과 독립적입니다.
          </p>
          {results.length >= 2 && (
            <Link
              className="button outline small"
              href={`/compare?ids=${results
                .slice(0, 3)
                .map((r) => r.creatorId)
                .join(",")}`}
            >
              상위 후보 비교 ↗
            </Link>
          )}
          {results.length === 0 && (
            <p className="empty">캠페인에 추천할 등록 프로필이 없습니다.</p>
          )}
          {results.map((r, i) => (
            <div key={r.creatorId} className="result">
              <span className="muted">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <Link href={`/creators/${r.creatorId}`}>
                  <h3>{r.creator.name} ↗</h3>
                </Link>
                <p style={{ fontSize: 13 }}>
                  {r.matchedTags.length
                    ? `일치 태그: ${r.matchedTags.join(", ")}`
                    : "일치 분위기 태그 없음"}
                  <br />
                  데이터 충족률 {r.coverage}% · 미확보:{" "}
                  {r.missing.join(", ") || "없음"}
                  {r.status === "hold" && (
                    <>
                      <br />
                      <span className="badge">보류</span> {r.reasons.join(", ")}{" "}
                      — 필수 조건 확인 필요
                    </>
                  )}
                </p>
                <details>
                  <summary style={{ fontSize: 13, cursor: "pointer" }}>
                    추천 근거 보기
                  </summary>
                  {r.breakdown.map((b) => (
                    <p key={b.factor} style={{ fontSize: 12, margin: "8px 0" }}>
                      {b.factor} ({b.weight}%):{" "}
                      {b.value === null
                        ? "미확보"
                        : Math.round(b.value * 100) + "점"}{" "}
                      · {b.evidence}
                    </p>
                  ))}
                  <p style={{ fontSize: 11 }}>
                    scorer {r.version} · 출처는 프로필에서 확인
                  </p>
                </details>
                {rateable && (
                  <MatchFeedback
                    campaignId={id}
                    creatorId={r.creatorId}
                    name={r.creator.name}
                    current={
                      feedback.find((f) => f.creator_id === r.creatorId) as
                        { verdict: Verdict; reason: string } | undefined
                    }
                  />
                )}
                {ownerId === user?.id &&
                  !isDemo &&
                  !shortlist?.items.some((i) => i.id === r.creatorId) && (
                    <ShortlistButton
                      campaignId={id}
                      listId={shortlist?.id ?? null}
                      creatorId={r.creatorId}
                      name={r.creator.name}
                      title={brief.title}
                    />
                  )}
              </div>
              <div className="score">
                {r.score}
                <small style={{ fontSize: 13 }}>점</small>
              </div>
            </div>
          ))}
          <h2 id="proposal" style={{ marginTop: 40 }}>
            협업의 첫 문장.
          </h2>
          {isDemo ? (
            <div className="notice">
              가상 캠페인입니다. 실제 제안·지원은 로그인 후 본인 캠페인과 실제
              등록된 크리에이터 계정으로 진행하세요.
            </div>
          ) : ownerId !== user?.id && recruit && !recruit.accepting ? (
            <div className="notice">모집이 마감되어 지원할 수 없습니다.</div>
          ) : (
            <ProposalForm
              campaignId={id}
              creators={people}
              selectedCreatorId={
                ownerId === user?.id &&
                people.some((person) => person.id === creator)
                  ? String(creator)
                  : undefined
              }
              kind={ownerId === user?.id ? "proposal" : "application"}
            />
          )}
        </div>
      </div>
    </section>
  );
}
