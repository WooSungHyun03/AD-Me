import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import { proposalSchema, canTransition } from "@/lib/schemas";
export const POST = apiRoute("proposals.post", async (req) => {
  const c = await requireContext();
  const d = await parseBody(req, proposalSchema, "제안 항목을 확인해주세요.");
  if (
    (d.kind === "proposal" && c.role !== "brand") ||
    (d.kind === "application" && c.role !== "creator")
  )
    return fail("역할에 맞는 요청만 가능합니다.", 403);
  const { data: campaign, error: campaignError } = await c.db
    .from("campaigns")
    .select("id,owner_id,status,moderation_status")
    .eq("id", d.campaignId)
    .maybeSingle();
  if (campaignError)
    failDatabase(campaignError, "캠페인을 불러오지 못했습니다.");
  const { data: creator, error: creatorError } = await c.db
    .from("creators")
    .select("id,owner_id,published,moderation_status")
    .eq("id", d.creatorId)
    .maybeSingle();
  if (creatorError)
    failDatabase(creatorError, "크리에이터를 불러오지 못했습니다.");
  if (!campaign || !creator?.owner_id || !creator.published || campaign.moderation_status !== "allowed" || creator.moderation_status !== "allowed")
    return fail("협업 가능한 캠페인과 실제 크리에이터 계정이 필요합니다.", 422);
  if (d.kind === "proposal" && campaign.owner_id !== c.user.id)
    return fail("본인 캠페인만 제안할 수 있습니다.", 403);
  if (
    d.kind === "application" &&
    (creator.owner_id !== c.user.id || campaign.status !== "published")
  )
    return fail("지원 권한이 없습니다.", 403);
  const { data, error } = await c.db
    .from("proposals")
    .insert({
      campaign_id: campaign.id,
      creator_id: creator.id,
      brand_id: campaign.owner_id,
      creator_user_id: creator.owner_id,
      brief: d.brief,
      kind: d.kind,
    })
    .select("id")
    .single();
  if (error?.code === "23505") fail("이미 지원하거나 제안했습니다.", 409);
  if (error) failDatabase(error, "지원·제안을 저장하지 못했습니다.");
  return NextResponse.json(data, { status: 201 });
});
export const PATCH = apiRoute("proposals.patch", async (req) => {
  const c = await requireContext();
  const b = await parseBody(
    req,
    z.object({
      id: z.uuid(),
      action: z.enum([
        "accepted",
        "rejected",
        "submitted",
        "completed",
        "revision_requested",
      ]),
    }),
    "잘못된 요청입니다.",
  );
  const { data: p, error: readError } = await c.db
    .from("proposals")
    .select("*")
    .eq("id", b.id)
    .maybeSingle();
  if (readError) failDatabase(readError, "협업 정보를 불러오지 못했습니다.");
  if (!p || ![p.brand_id, p.creator_user_id].includes(c.user.id))
    return fail("접근할 수 없습니다.", 403);
  const role = p.brand_id === c.user.id ? "brand" : "creator";
  if (!canTransition(p.kind, p.status, b.action, role))
    return fail("현재 상태에서 허용되지 않는 변경입니다.", 409);
  const { data, error } = await c.db.rpc("transition_proposal", {
    p_id: p.id,
    p_action: b.action,
  });
  if (error?.code === "P0001" && error.message === "forbidden")
    fail("접근할 수 없습니다.", 403);
  if (error?.code === "P0001" && error.message === "invalid transition")
    fail("상태 변경이 충돌했습니다. 새로고침 후 다시 시도해주세요.", 409);
  if (error) failDatabase(error, "협업 상태를 변경하지 못했습니다.");
  return NextResponse.json({ ok: true, data });
});
