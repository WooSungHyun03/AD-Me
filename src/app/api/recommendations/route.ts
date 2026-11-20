import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import {
  recommendationCreateSchema,
  recommendationPageSchema,
} from "@/lib/recommendation-snapshots";
export const POST = apiRoute("recommendations.create", async (req) => {
  const c = await requireContext(),
    p = await parseBody(
      req,
      recommendationCreateSchema,
      "추천 저장 항목을 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("recommendation_create", {
    p_campaign: p.campaignId,
    p_key: p.clientKey,
  });
  if (error) failDatabase(error, "추천을 저장하지 못했습니다.");
  if (!z.uuid().safeParse(data).success)
    fail("추천 저장 응답을 확인하지 못했습니다.", 503);
  return Response.json(
    { ok: true, id: data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const GET = apiRoute("recommendations.get", async (req) => {
  const c = await requireContext(),
    p = parseInput(
      z.strictObject({ campaignId: z.uuid(), snapshotId: z.uuid().optional() }),
      Object.fromEntries(new URL(req.url).searchParams),
      "추천 조회 항목을 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("recommendation_page", {
    p_campaign: p.campaignId,
    p_snapshot: p.snapshotId ?? null,
  });
  if (error) failDatabase(error, "저장한 추천을 불러오지 못했습니다.");
  const parsed = recommendationPageSchema.safeParse(data);
  if (
    !parsed.success ||
    parsed.data.campaignId !== p.campaignId ||
    (p.snapshotId && parsed.data.snapshot?.id !== p.snapshotId)
  )
    fail("추천 응답을 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
