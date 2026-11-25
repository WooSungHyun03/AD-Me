import Link from "next/link";
import { notFound } from "next/navigation";
import { campaigns, rank, type Brief } from "@/lib/catalog";
import { configured, supabase, currentUser } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
import { readCreatorProposalChoices } from "@/lib/creator-catalog-read";
import { ProposalForm } from "@/components/proposal-form";
import {
  CampaignTermsSummary,
  ScheduleHistory,
  type ScheduleChange,
} from "@/components/campaign-terms-summary";
import type { CampaignTerms } from "@/lib/campaign-brief";
import { isDemoMode } from "@/lib/mode";
import { readSavedLists, itemLabel, type SavedList } from "@/lib/saved-lists";
import { RemoveItem, ShortlistButton } from "@/components/lists";
import { ChecklistEditor, ReviewForm } from "@/components/selection-review";
import { MatchFeedback } from "@/components/match-feedback";
import { SHOWN, type Verdict } from "@/lib/matching-eval";

// D061: brand-private selection review state per candidate, addressed by public reference.
type ReviewCandidate = {
  ref: string;
  name: string;
  applicant: boolean;
  checked: string[];
  memo: string;
  approved: boolean;
  reviewed_at: string | null;
};
export default async function Campaign({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const [{ id }, { creator }] = await Promise.all([params, searchParams]);
  const demo = isDemoMode();
  let brief:
    | (Brief & {
        title: string;
        product: string;
        goal: string;
        target_audience: string;
        terms?: CampaignTerms;
      })
    | undefined = demo ? campaigns.find((c) => c.seed_id === id) : undefined;
  let isDemo = true,
    ownerId: string | null = null;
  let capacity: number | null = null;
  let selected: number | null = null;
  let deadline: string | null = null;
  let closed = false;
  let people: { id: string; name: string }[] = [];
  // D036: the owner's campaign shortlist (one per campaign, created on first add).
  let shortlist: SavedList | null = null;
  let scheduleChanges: ScheduleChange[] = [];
  let review: {
    items: { id: string; label: string }[];
    candidates: ReviewCandidate[];
  } | null = null;
  let feedback: { ref: string; verdict: Verdict; reason: string }[] = [];
  const user = await currentUser();
  if (configured()) {
    const db = await supabase();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data && (!data.is_demo || demo)) {
      brief = data.brief;
      isDemo = data.is_demo;
      ownerId = data.owner_id;
      capacity = data.capacity;
      deadline = data.recruit_until;
      closed = data.status === "closed";
      if (user?.id === ownerId && !isDemo)
        shortlist =
          (await readSavedLists(db))?.find((l) => l.campaign_id === id) ?? null;
      if (user?.id === ownerId && !isDemo) {
        // D061/D046: owner-only gateways return candidates and ratings under public references.
        const [items, candidates, rated] = await Promise.all([
          db
            .from("review_checklist_items")
            .select("id,label")
            .order("position")
            .order("created_at"),
          db.rpc("campaign_selection_reviews", { p_campaign: id }),
          db.rpc("my_recommendation_feedback", { p_campaign: id }),
        ]);
        if (!items.error && !candidates.error)
          review = {
            items: items.data ?? [],
            candidates: (candidates.data ?? []) as ReviewCandidate[],
          };
        feedback = (rated.data ?? []) as typeof feedback;
      }
      if (user?.id === ownerId && capacity != null) {
        const result = await db.rpc("campaign_selected", { p_campaign: id });
        if (typeof result.data === "number") selected = result.data;
      }
    } else if (!demo || !id.startsWith("campaign-")) notFound();
    if (user && data) {
      people = await readCreatorProposalChoices(db, data.id);
      // RLS returns rows only to the owner and parties of this campaign's proposals.
      const history = await db
        .from("campaign_schedule_changes")
        .select("changed_at,previous,next")
        .eq("campaign_id", data.id)
        .order("changed_at", { ascending: false })
        .limit(20);
      scheduleChanges = (history.data ?? []) as ScheduleChange[];
    }
  }
  if (!brief) notFound();
  const catalog = await publicCreators();
  const results = rank(brief, catalog).slice(0, SHOWN);
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
            {capacity != null && (
              <div>
                <strong>
                  {selected == null
                    ? `${capacity}명`
                    : `${selected}/${capacity}명`}
                </strong>
                <span>선정 인원</span>
              </div>
            )}
          </div>
          {deadline && (
            <p>
              모집 마감{" "}
              <time dateTime={deadline}>
                {new Intl.DateTimeFormat("ko-KR", {
                  timeZone: "Asia/Seoul",
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(deadline))}{" "}
                KST
              </time>
            </p>
          )}
          {closed && <p>모집이 마감되었습니다.</p>}
          {ownerId === user?.id && !isDemo && (
            <div className="actions">
              <Link
                className="button outline small"
                href={`/campaigns/${id}/edit`}
              >
                캠페인 수정·모집 관리
              </Link>
              <Link
                className="button outline small"
                href={`/campaigns/${id}/copy`}
              >
                새 초안으로 복제
              </Link>
              <Link
                className="button outline small"
                href={`/campaigns/${id}/brief`}
              >
                브리프 첨부·이력
              </Link>
            </div>
          )}
          <h3>캠페인 목표</h3>
          <p>{brief.goal}</p>
          <CampaignTermsSummary terms={brief.terms} />
          <ScheduleHistory changes={scheduleChanges} />
          {ownerId === user?.id && !isDemo && brief.terms && (
            <p>
              <a
                className="button outline small"
                href={`/api/campaigns/${id}/calendar`}
              >
                캠페인 일정 다운로드
              </a>
              <br />내 캘린더에 가져올 수 있습니다. 다운로드한 일정은 자동
              갱신되지 않습니다.
            </p>
          )}
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
          {review && (
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
              {!review.candidates.length && (
                <p className="empty">
                  지원자나 캠페인 후보가 생기면 여기에서 검토합니다.
                </p>
              )}
              {review.candidates.map((x) => (
                <ReviewForm
                  key={x.ref}
                  campaignId={id}
                  creatorId={x.ref}
                  name={x.applicant ? `${x.name} · 지원자` : x.name}
                  items={review!.items}
                  review={
                    x.reviewed_at || x.memo || x.checked.length ? x : undefined
                  }
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
          {configured() && ownerId === user?.id && (
            <p>
              <Link
                className="button outline small"
                href={`/campaigns/${id}/recommendations`}
              >
                추천 저장·이전 결과 확인 ↗
              </Link>
            </p>
          )}
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
          {configured() && ownerId === user?.id && !isDemo && (
            <div className="panel" style={{ margin: "20px 0" }}>
              <h3 style={{ marginTop: 0 }}>
                캠페인 후보 목록 ({shortlist?.items.length ?? 0})
              </h3>
              {shortlist?.items.length ? (
                shortlist.items.map((i) => (
                  <div className="result" key={i.ref}>
                    <span>↗</span>
                    {i.visible ? (
                      <Link href={`/creators/${encodeURIComponent(i.ref)}`}>
                        {itemLabel(i)}
                      </Link>
                    ) : (
                      <span className="muted">{itemLabel(i)}</span>
                    )}
                    <RemoveItem
                      listId={shortlist.id}
                      creatorId={i.ref}
                      name={itemLabel(i)}
                    />
                  </div>
                ))
              ) : (
                <p className="empty">
                  아래 추천에서 &lsquo;후보에 담기&rsquo;로 후보를 모으세요.
                </p>
              )}
            </div>
          )}
          {results.length === 0 && (
            <p className="empty">캠페인에 추천할 등록 프로필이 없습니다.</p>
          )}
          {results.map((r, i) => (
            <div key={r.creatorId} className="result">
              <span className="muted">{String(i + 1).padStart(2, "0")}</span>
              <div>
                {r.creator.is_demo && (
                  <span className="badge">가상 크리에이터 · DEMO</span>
                )}
                <Link href={`/creators/${r.creatorId}`}>
                  <h3>{r.creator.name} ↗</h3>
                </Link>
                {r.status === "hold" && (
                  <p className="notice">
                    필수 조건 확인 필요: {r.reasons.join(" · ")}
                  </p>
                )}
                <p style={{ fontSize: 13 }}>
                  {r.matchedTags.length
                    ? `일치 태그: ${r.matchedTags.join(", ")}`
                    : "일치 분위기 태그 없음"}
                  <br />
                  데이터 충족률 {r.coverage}% · 미확보: {r.missing.join(", ")}
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
                {review && (
                  <MatchFeedback
                    campaignId={id}
                    creatorId={r.creatorId}
                    name={r.creator.name}
                    current={feedback.find((f) => f.ref === r.creatorId)}
                  />
                )}
                {configured() &&
                  ownerId === user?.id &&
                  !isDemo &&
                  !shortlist?.items.some((i) => i.ref === r.creatorId) && (
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
          ) : !closed ? (
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
          ) : null}
        </div>
      </div>
    </section>
  );
}
