import Link from "next/link";
import { notFound } from "next/navigation";
import { campaigns, rank, type Brief } from "@/lib/catalog";
import { configured, supabase, currentUser } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
import { readCreatorProposalChoices } from "@/lib/creator-catalog-read";
import { ProposalForm } from "@/components/proposal-form";
import { CampaignTermsSummary } from "@/components/campaign-terms-summary";
import type { CampaignTerms } from "@/lib/campaign-brief";
import { isDemoMode } from "@/lib/mode";
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
      if (user?.id === ownerId && capacity != null) {
        const result = await db.rpc("campaign_selected", { p_campaign: id });
        if (typeof result.data === "number") selected = result.data;
      }
    } else if (!demo || !id.startsWith("campaign-")) notFound();
    if (user && data) {
      people = await readCreatorProposalChoices(db, data.id);
    }
  }
  if (!brief) notFound();
  const catalog = await publicCreators();
  const results = rank(brief, catalog).slice(0, 6);
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
          <h2>브랜드에 어울리는 발견.</h2>
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
