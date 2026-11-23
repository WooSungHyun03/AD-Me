import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import { publicReviewSchema } from "@/lib/reviews";
export async function PublicReviewRecords({
  creatorId,
}: {
  creatorId: string;
}) {
  if (!configured())
    return (
      <p>공개 검토 자료가 없습니다. 자료 부족은 안전성을 보증하지 않습니다.</p>
    );
  const db = await supabase(),
    { data, error } = await db.rpc("public_review_records", {
      p_creator: creatorId,
      p_kind: "issue",
    });
  const parsed = z.array(publicReviewSchema).max(50).safeParse(data);
  if (error || !parsed.success)
    return <p className="notice">공개 검토 자료를 불러오지 못했습니다.</p>;
  return (
    <>
      {!parsed.data.length && (
        <p>
          공개 검토 자료가 없습니다. 자료 부족은 안전성을 보증하지 않습니다.
          미확인 주장을 자동 생성하지 않습니다.
        </p>
      )}
      {parsed.data.map((r) => (
        <div className="notice" key={r.id} data-testid="public-review">
          <strong>
            {r.classification === "official_correction"
              ? "공식 정정 자료"
              : "출처 확인 자료"}
          </strong>
          {r.isDemo && <span className="badge">DEMO</span>}
          <p>{r.summary}</p>
          <a
            href={r.payload.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            검토 출처 ↗
          </a>
          <p>
            운영 검토 · 버전 {r.version} ·{" "}
            {new Date(r.reviewedAt).toLocaleDateString("ko-KR", {
              timeZone: "Asia/Seoul",
            })}{" "}
            · 정책 {r.policyVersion}
          </p>
          {r.response && (
            <div>
              <strong>당사자 입장</strong>
              <p>{r.response.body}</p>
              {r.response.sourceUrl && (
                <a
                  href={r.response.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  입장 출처 ↗
                </a>
              )}
            </div>
          )}
        </div>
      ))}
      <p className="muted">
        검토 자료를 자동 위험 점수나 추천 제외 조건으로 사용하지 않습니다.
      </p>
    </>
  );
}
