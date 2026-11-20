import { apiRoute, failDatabase, parseBody } from "@/lib/api";
import { requireAdminContext } from "@/lib/admin";
import { reviewDecisionSchema } from "@/lib/reviews";
import { requireReviewResult } from "@/lib/review-server";
export const POST = apiRoute("reviews.decide", async (req) => {
  const c = await requireAdminContext(),
    p = await parseBody(
      req,
      reviewDecisionSchema,
      "판정·근거·공개 범위를 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("review_decide", {
    p_id: p.id,
    p_expected: p.expectedVersion,
    p_verdict: p.verdict,
    p_classification: p.classification,
    p_note: p.note,
    p_summary: p.summary,
    p_publish: p.publish,
  });
  if (error)
    failDatabase(
      error,
      "검토를 저장하지 못했습니다. 최신 버전과 공개 정책을 확인해주세요.",
    );
  requireReviewResult(data);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
});
