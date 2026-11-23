import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { configured, supabase, currentUser } from "@/lib/supabase";
import { recommendationPageSchema } from "@/lib/recommendation-snapshots";
import { RecommendationSave } from "@/components/recommendation-save";
import { isDemoMode } from "@/lib/mode";
export const dynamic = "force-dynamic";
const kst = (v: string) =>
  new Date(v).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
export default async function RecommendationHistory({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ snapshot?: string }>;
}) {
  const { id } = await params,
    q = await searchParams;
  if (
    !z.uuid().safeParse(id).success ||
    (q.snapshot && !z.uuid().safeParse(q.snapshot).success)
  )
    notFound();
  if (!configured() || !(await currentUser()))
    redirect(
      `/login?next=${encodeURIComponent(`/campaigns/${id}/recommendations`)}`,
    );
  const db = await supabase(),
    { data, error } = await db.rpc("recommendation_page_v12", {
      p_campaign: id,
      p_snapshot: q.snapshot ?? null,
      p_demo: isDemoMode(),
    });
  if (error?.code === "42501") notFound();
  const parsed = recommendationPageSchema.safeParse(data);
  if (
    error ||
    !parsed.success ||
    parsed.data.campaignId !== id ||
    (q.snapshot && parsed.data.snapshot?.id !== q.snapshot)
  )
    return (
      <section className="wrap narrow">
        <h1>추천을 불러오지 못했습니다.</h1>
        <p>저장 기능의 적용 상태를 확인한 뒤 다시 시도해주세요.</p>
        <Link
          className="button outline"
          href={`/campaigns/${id}/recommendations`}
        >
          다시 불러오기
        </Link>
      </section>
    );
  const page = parsed.data,
    s = page.snapshot;
  return (
    <section className="wrap narrow">
      <Link href={`/campaigns/${id}`}>← 캠페인으로</Link>
      <h1 className="page-title">추천 기록과 근거.</h1>
      <p>
        브랜드 본인만 보는 저장 결과입니다. 태그·분야·예산·형식과 저장한 필수
        조건을 사용하며 HOT 노출은 점수 입력에 포함하지 않습니다. 실제 성과를
        예측하거나 광고 적합성을 보증하지 않습니다.
      </p>
      <RecommendationSave campaignId={id} hasSnapshot={!!s} />
      {!s ? (
        <p className="notice">
          아직 저장한 추천이 없습니다. 저장하면 입력과 근거를 다시 확인할 수
          있습니다.
        </p>
      ) : (
        <>
          <p>
            계산 시각: <time dateTime={s.createdAt}>{kst(s.createdAt)}</time>{" "}
            (KST) · 모델 {s.modelVersion}
          </p>
          {q.snapshot && (
            <p className="notice">
              선택한 과거 결과입니다.{" "}
              <Link href={`/campaigns/${id}/recommendations`}>
                최신 저장 결과 보기
              </Link>
            </p>
          )}
          {s.stale && (
            <p role="status" className="notice">
              캠페인 입력 또는 공개 프로필 데이터가 변경되었습니다. 아래는 이전
              데이터로 계산한 결과입니다. 재계산하면 새 기록으로 저장됩니다.
            </p>
          )}
          <details>
            <summary>저장한 입력·출처 범위</summary>
            <p>
              분야 {s.input.category || "미확인"} · 태그{" "}
              {s.input.vibes.join(", ") || "없음"} · 형식{" "}
              {s.input.format || "미확인"} · 예산{" "}
              {s.input.budget_krw.toLocaleString()}원 · 플랫폼{" "}
              {s.input.platforms.join(", ")}
            </p>
            {s.input.policy ? (
              <p>
                분야: {s.input.policy.category === "hard" ? "필수" : "선호"} ·
                예산: {s.input.policy.budget === "hard" ? "필수" : "선호"} ·
                필수 정보 미확인:{" "}
                {s.input.policy.unknown === "hold" ? "보류" : "제외"} ·{" "}
                {s.input.includeDemo
                  ? "가상 테스트 자료 포함"
                  : "가상 자료 제외"}
              </p>
            ) : (
              <p>
                이전 1.0 기록입니다. 필수 조건 정책이 저장되지 않은 당시 계산
                결과입니다.
              </p>
            )}
            <p>
              공개 목록 {s.catalogCount}명 중 기본 조건 통과 {s.eligibleCount}
              명, 확인 전 보류 {s.heldCount ?? 0}명. 확정 후보를 먼저 표시하며
              상위 최대6명입니다. 목록 상한1000명을 넘으면 저장을 거부합니다.
              오디언스·추정 성과는 미확인입니다. 본인 등록 정보는 플랫폼 검증
              지표가 아닙니다.
            </p>
            <p>
              출처 계약 {s.sourceContract} · 데이터 버전{" "}
              {s.sourceVersion.slice(0, 8)}
            </p>
          </details>
          {s.withheldCount > 0 && (
            <p className="notice">
              현재 공개 범위를 벗어난 후보 {s.withheldCount}명은 과거 기록에서도
              표시하지 않습니다.
            </p>
          )}
          {!s.results.length && (
            <p className="notice">
              현재 표시할 수 있는 저장 후보가 없습니다. 조건을 확인하거나 새
              데이터로 재계산해주세요.
            </p>
          )}
          {s.results.map((r) => (
            <article
              className="result"
              key={r.creatorId}
              data-testid="saved-recommendation"
            >
              <span>{r.position}</span>
              <div>
                {r.isDemo && (
                  <span className="badge">가상 크리에이터 · DEMO</span>
                )}
                <h2>
                  <Link href={`/creators/${encodeURIComponent(r.creatorId)}`}>
                    {r.name} ↗
                  </Link>
                </h2>
                {r.status === "hold" && (
                  <p className="notice">
                    확인 전 보류 · {r.reasons?.join(", ")}. 필수 조건 통과
                    후보가 아닙니다.
                  </p>
                )}
                <p>
                  일치 태그: {r.matchedTags.join(", ") || "없음"} · 데이터
                  충족률 {r.coverage}%
                </p>
                <p>미확인: {r.missing.join(", ")}</p>
                <details>
                  <summary>저장한 추천 근거 보기</summary>
                  {r.breakdown.map((b) => (
                    <p key={b.factor}>
                      {b.factor} ({b.weight}%):{" "}
                      {b.value === null
                        ? "미확인"
                        : `${Math.round(b.value * 100)}점`}{" "}
                      · {b.evidence}
                    </p>
                  ))}
                  <p>
                    {r.sourceType === "owner_registration"
                      ? "본인 등록 · 외부 검증 미확인"
                      : "가상 테스트 자료"}{" "}
                    · 출처 버전 {r.sourceVersion.slice(0, 8)}
                  </p>
                  {r.sourceUrl && (
                    <a
                      href={r.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      현재 공개 동의가 유지된 출처 ↗
                    </a>
                  )}
                </details>
              </div>
              <div className="score" style={{ whiteSpace: "nowrap" }}>
                {r.score ?? "—"}
                <small style={{ fontSize: 13 }}>점</small>
              </div>
            </article>
          ))}
        </>
      )}
      <h2>최근 저장 기록</h2>
      <p>최근20개 기록입니다. 재계산해도 기존 결과를 덮어쓰지 않습니다.</p>
      <ul>
        {page.history.map((h) => (
          <li key={h.id}>
            <Link
              href={`/campaigns/${id}/recommendations?snapshot=${h.id}`}
              aria-current={s?.id === h.id ? "page" : undefined}
            >
              {kst(h.createdAt)} (KST){s?.id === h.id ? " · 현재 선택" : ""}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
