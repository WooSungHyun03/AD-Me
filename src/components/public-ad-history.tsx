import { z } from "zod";
import { configured, supabase } from "@/lib/supabase";
import {
  publicAdReviewSchema,
  adDisclosureLabels,
  adInterestLabels,
} from "@/lib/reviews";
export async function PublicAdHistory({ creatorId }: { creatorId: string }) {
  if (!configured()) return null;
  const db = await supabase(),
    { data, error } = await db.rpc("public_review_records", {
      p_creator: creatorId,
      p_kind: "ad",
    }),
    parsed = z.array(publicAdReviewSchema).max(50).safeParse(data);
  if (error || !parsed.success)
    return <p className="notice">제출 광고 이력을 불러오지 못했습니다.</p>;
  if (!parsed.data.length)
    return (
      <p>
        공개된 제출 광고 이력이 없습니다. 자료 미확보는 광고 경험이 없다는 뜻이
        아닙니다.
      </p>
    );
  return (
    <>
      {[...parsed.data]
        .sort(
          (a, b) =>
            b.payload.startedOn.localeCompare(a.payload.startedOn) ||
            a.id.localeCompare(b.id),
        )
        .map((r) => (
          <div
            className="notice"
            key={r.id}
            data-testid="public-ad-history"
            style={{ overflowWrap: "anywhere" }}
          >
            <strong>{r.payload.brandLabel}</strong>
            {r.isDemo && <span className="badge">DEMO</span>}
            <p>
              {r.payload.startedOn} ~ {r.payload.endedOn} · {r.payload.category}{" "}
              · {r.payload.format}
            </p>
            <p>
              {adInterestLabels[r.payload.interest]} ·{" "}
              {adDisclosureLabels[r.payload.disclosure]}
            </p>
            <p>{r.summary}</p>
            <a
              href={r.payload.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              광고 근거 출처 ↗
            </a>
            <p>
              본인 제출 자료의 운영 검토 · 버전 {r.version} ·{" "}
              {new Date(r.reviewedAt).toLocaleDateString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              · 정책 {r.policyVersion}
            </p>
            <p className="muted">
              플랫폼 소유권 인증이나 법적 표시 준수 보증이 아닙니다.
            </p>
          </div>
        ))}
    </>
  );
}
