import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { campaignSchema } from "@/lib/schemas";
export const POST = apiRoute("campaigns.post", async (req) => {
  const c = await requireContext();
  if (c.role !== "brand")
    return fail("브랜드 계정만 캠페인을 만들 수 있습니다.", 403);
  const brief = await parseBody(
    req,
    campaignSchema,
    "캠페인 입력 항목을 확인해주세요.",
  );
  const { data, error } = await c.db
    .from("campaigns")
    .insert({
      owner_id: c.user.id,
      brief,
      status: brief.status,
      ...(brief.recruit_until !== undefined
        ? { recruit_until: brief.recruit_until }
        : {}),
      ...(brief.capacity !== undefined ? { capacity: brief.capacity } : {}),
    })
    .select("id")
    .single();
  if (error) failDatabase(error, "캠페인을 저장하지 못했습니다.");
  return NextResponse.json(data, { status: 201 });
});
export const PATCH = apiRoute("campaigns.patch", async (req) => {
  const c = await requireContext();
  if (c.role !== "brand") return fail("권한이 없습니다.", 403);
  const body = await parseBody(
    req,
    z.object({ id: z.uuid(), brief: campaignSchema }),
    "입력 항목을 확인해주세요.",
  );
  const { data, error } = await c.db
    .from("campaigns")
    .update({
      brief: body.brief,
      status: body.brief.status,
      ...(body.brief.recruit_until !== undefined
        ? { recruit_until: body.brief.recruit_until }
        : {}),
      ...(body.brief.capacity !== undefined
        ? { capacity: body.brief.capacity }
        : {}),
    })
    .eq("id", body.id)
    .eq("owner_id", c.user.id)
    .select("id")
    .maybeSingle();
  if (error) failDatabase(error, "수정할 수 없습니다.");
  if (!data) fail("수정할 수 없습니다.", 403);
  return NextResponse.json(data);
});
export const DELETE = apiRoute("campaigns.delete", async (req) => {
  const c = await requireContext();
  if (c.role !== "brand") fail("권한이 없습니다.", 403);
  const [id] = parseInput(
    z.tuple([z.uuid()]),
    new URL(req.url).searchParams.getAll("id"),
    "캠페인 ID를 확인해주세요.",
  );
  const { data, error } = await c.db
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("owner_id", c.user.id)
    .select("id");
  if (error) failDatabase(error, "삭제할 수 없습니다.");
  if (!data?.length) fail("삭제할 수 없습니다.", 403);
  return NextResponse.json({ ok: true });
});
