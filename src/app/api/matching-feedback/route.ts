import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { rank, type Brief } from "@/lib/catalog";
import { publicCreators } from "@/lib/data";
import { REASONS, SHOWN } from "@/lib/matching-eval";
import { storageAdmin } from "@/lib/uploads";
// D046: rating a shown recommendation. Rank, score and scorer version are recomputed here, never taken
// from the client, so a rating always refers to what the server actually displayed.
async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      campaignId: z.uuid(),
      creatorId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      verdict: z.enum(["fit", "unfit"]),
      reason: z.string(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success || !(p.data.reason in REASONS[p.data.verdict]))
    return fail("평가 사유를 골라주세요.");
  const { data: campaign } = await c.db
    .from("campaigns")
    .select("owner_id,is_demo,brief")
    .eq("id", p.data.campaignId)
    .maybeSingle();
  if (!campaign || campaign.owner_id !== c.user.id || campaign.is_demo)
    return fail("본인 캠페인의 추천만 평가할 수 있습니다.", 403);
  const shown = rank(campaign.brief as Brief, await publicCreators()).slice(
    0,
    SHOWN,
  );
  const i = shown.findIndex((r) => r.creatorId === p.data.creatorId);
  if (i < 0) return fail("현재 추천 목록에 없는 크리에이터입니다.", 409);
  // Server-only write (the table grants no client insert/update); ownership was checked above via RLS read
  // and again in the service-only RPC, which resolves the public reference to the internal creator id.
  const admin = storageAdmin();
  if (!admin) return fail("서버 키가 설정되지 않았습니다.", 503);
  const { error } = await admin.rpc("rate_recommendation", {
    p_rater: c.user.id,
    p_campaign: p.data.campaignId,
    p_creator: p.data.creatorId,
    p_version: shown[i].version,
    p_rank: i + 1,
    p_score: shown[i].score,
    p_verdict: p.data.verdict,
    p_reason: p.data.reason,
  });
  if (error) return fail("평가를 저장하지 못했습니다.", 400);
  return NextResponse.json({ ok: true, rank_position: i + 1 });
}

export const POST = compatibleApiRoute(
  "src/app/api/matching-feedback/route.ts.POST",
  handlePOST,
);
