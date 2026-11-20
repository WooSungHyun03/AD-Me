import Link from "next/link";
import { notFound } from "next/navigation";
import { campaigns, rank, type Brief } from "@/lib/catalog";
import { configured, supabase, currentUser } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
import { ProposalForm } from "@/components/proposal-form";
import { CampaignTermsSummary } from "@/components/campaign-terms-summary";
import type { CampaignTerms } from "@/lib/campaign-brief";
export default async function Campaign({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let brief:
    | (Brief & {
        title: string;
        product: string;
        goal: string;
        target_audience: string;
        terms?: CampaignTerms;
      })
    | undefined = campaigns.find((c) => c.seed_id === id);
  let isDemo = true,
    ownerId: string | null = null;
  let people: { id: string; name: string }[] = [];
  const user = await currentUser();
  if (configured()) {
    const db = await supabase();
    const { data } = await db
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (data) {
      brief = data.brief;
      isDemo = data.is_demo;
      ownerId = data.owner_id;
    } else if (!id.startsWith("campaign-")) notFound();
    const { data: cs } = await db
      .from("creators")
      .select("id,profile,owner_id")
      .not("owner_id", "is", null)
      .eq("published", true)
      .eq("moderation_status", "allowed");
    people = (cs ?? [])
      .filter((c) => ownerId === user?.id || c.owner_id === user?.id)
      .map((c) => ({ id: c.id, name: c.profile.name }));
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
          </div>
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
          <CampaignTermsSummary terms={brief.terms} />
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
          <Link
            className="button outline small"
            href={`/compare?ids=${results
              .slice(0, 3)
              .map((r) => r.creatorId)
              .join(",")}`}
          >
            상위 후보 3명 비교 ↗
          </Link>
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
          <h2 style={{ marginTop: 40 }}>협업의 첫 문장.</h2>
          {isDemo ? (
            <div className="notice">
              가상 캠페인입니다. 실제 제안·지원은 로그인 후 본인 캠페인과 실제
              등록된 크리에이터 계정으로 진행하세요.
            </div>
          ) : (
            <ProposalForm
              campaignId={id}
              creators={people}
              kind={ownerId === user?.id ? "proposal" : "application"}
            />
          )}
        </div>
      </div>
    </section>
  );
}
