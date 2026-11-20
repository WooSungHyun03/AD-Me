import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
import { reviewActionSchema } from "@/lib/reviews";
import {
  decodeReviewCursor,
  readReviewInbox,
  requireReviewResult,
} from "@/lib/review-server";
export const GET = apiRoute("reviews.get", async (req) => {
  const c = await requireContext(),
    cursor = new URL(req.url).searchParams.get("cursor") ?? undefined;
  decodeReviewCursor(cursor);
  return Response.json(await readReviewInbox(c.db, cursor), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const POST = apiRoute("reviews.post", async (req) => {
  const c = await requireContext(),
    p = await parseBody(
      req,
      reviewActionSchema,
      "검토 자료 항목을 확인해주세요.",
    );
  const shared = { p_id: p.id, p_expected: p.expectedVersion };
  const result =
    p.action === "revise"
      ? await c.db.rpc("review_revise", { ...shared, p_payload: p.payload })
      : p.action === "respond"
        ? await c.db.rpc("review_respond", {
            ...shared,
            p_body: p.body,
            p_source: p.sourceUrl,
            p_public: p.publishConsent,
          })
        : await c.db.rpc("review_withdraw", shared);
  if (result.error)
    failDatabase(
      result.error,
      "검토 자료를 변경하지 못했습니다. 최신 내용을 확인해주세요.",
    );
  requireReviewResult(
    result.data,
    p.action === "revise"
      ? "version"
      : p.action === "withdraw"
        ? "boolean"
        : "id",
  );
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
});
