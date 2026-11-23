import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { proposalSchema, canTransition, recruitingError } from "@/lib/schemas";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = proposalSchema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("제안 항목을 확인해주세요.");
  const d = p.data;
  if (
    (d.kind === "proposal" && c.role !== "brand") ||
    (d.kind === "application" && c.role !== "creator")
  )
    return fail("역할에 맞는 요청만 가능합니다.", 403);
  const { data: campaign } = await c.db
    .from("campaigns")
    .select("id,owner_id,status")
    .eq("id", d.campaignId)
    .single();
  const { data: creator } = await c.db
    .from("creators")
    .select("id,owner_id,published")
    .eq("id", d.creatorId)
    .single();
  if (!campaign || !creator?.owner_id || !creator.published)
    return fail("협업 가능한 실제 크리에이터 계정이 필요합니다.");
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
  if (error)
    return fail(
      recruitingError(error.message) ??
        "이미 지원·제안했거나, 모집이 마감·정원 충족되어 저장하지 못했습니다.",
      409,
    );
  return NextResponse.json(data, { status: 201 });
}
export async function PATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const b = await req.json().catch(() => null);
  if (!b || typeof b.id !== "string" || typeof b.action !== "string")
    return fail("잘못된 요청입니다.");
  const { data: p } = await c.db
    .from("proposals")
    .select("*")
    .eq("id", b.id)
    .single();
  if (!p || ![p.brand_id, p.creator_user_id].includes(c.user.id))
    return fail("접근할 수 없습니다.", 403);
  const role = p.brand_id === c.user.id ? "brand" : "creator";
  if (!canTransition(p.kind, p.status, b.action, role))
    return fail("현재 상태에서 허용되지 않는 변경입니다.", 409);
  const { data, error } = await c.db.rpc("transition_proposal", {
    p_id: p.id,
    p_action: b.action,
  });
  if (error)
    return fail(
      recruitingError(error.message) ??
        "상태 변경이 충돌했습니다. 새로고침 후 다시 시도해주세요.",
      409,
    );
  return NextResponse.json({ ok: true, data });
}
