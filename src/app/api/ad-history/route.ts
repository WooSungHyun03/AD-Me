import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { adPayloadSchema, publicAdReviewSchema } from "@/lib/reviews";
import { requireReviewResult } from "@/lib/review-server";
import { configured, supabase } from "@/lib/supabase";
export const POST = apiRoute("ad-history.post", async (req) => {
  const c = await requireContext();
  if (c.role !== "creator")
    fail("본인 프로필의 광고 이력만 제출할 수 있습니다.", 403);
  const p = await parseBody(
    req,
    z.strictObject({
      creatorId: z.string().min(1).max(100),
      clientKey: z.uuid().optional(),
      payload: adPayloadSchema,
    }),
    "광고 이력과 제출 권한 확인을 검토해주세요.",
  );
  const { data, error } = await c.db.rpc("review_submit", {
    p_kind: "ad",
    p_creator: p.creatorId,
    p_key: p.clientKey ?? randomUUID(),
    p_payload: p.payload,
  });
  if (error)
    failDatabase(
      error,
      "광고 이력을 저장하지 못했습니다. 기존 출처와 제출 권한을 확인해주세요.",
    );
  requireReviewResult(data);
  return Response.json(
    { ok: true, id: data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const GET = apiRoute("ad-history.get", async (req) => {
  const q = parseInput(
    z.strictObject({ creatorId: z.string().min(1).max(100) }),
    Object.fromEntries(new URL(req.url).searchParams),
    "대상 프로필을 확인해주세요.",
  );
  if (!configured())
    return Response.json([], { headers: { "Cache-Control": "no-store" } });
  const db = await supabase(),
    { data, error } = await db.rpc("public_review_records", {
      p_creator: q.creatorId,
      p_kind: "ad",
    });
  if (error) failDatabase(error, "공개 광고 이력을 불러오지 못했습니다.");
  const parsed = z.array(publicAdReviewSchema).max(50).safeParse(data);
  if (!parsed.success) fail("광고 이력 응답을 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
