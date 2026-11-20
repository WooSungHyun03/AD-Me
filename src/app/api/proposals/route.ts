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
  const { data, error } = await c.db.rpc("create_creator_proposal", {
    p_campaign: d.campaignId,
    p_creator: d.creatorId,
    p_kind: d.kind,
    p_brief: d.brief,
  });
  if (error?.code === "23505") fail("이미 지원하거나 제안했습니다.", 409);
  if (error) failDatabase(error, "지원·제안을 저장하지 못했습니다.");
  const id = z.uuid().safeParse(data);
  if (!id.success) fail("지원·제안 응답을 확인하지 못했습니다.", 503);
  return NextResponse.json({ id: id.data }, { status: 201 });
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
