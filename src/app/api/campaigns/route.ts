import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { campaignSchema } from "@/lib/schemas";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "brand")
    return fail("브랜드 계정만 캠페인을 만들 수 있습니다.", 403);
  const parsed = campaignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("캠페인 입력 항목을 확인해주세요.");
  const { data, error } = await c.db
    .from("campaigns")
    .insert({
      owner_id: c.user.id,
      brief: parsed.data,
      status: parsed.data.status,
    })
    .select("id")
    .single();
  if (error) return fail("캠페인을 저장하지 못했습니다.", 500);
  return NextResponse.json(data, { status: 201 });
}
export async function PATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "brand") return fail("권한이 없습니다.", 403);
  const body = await req.json().catch(() => null);
  const parsed = campaignSchema.safeParse(body?.brief);
  if (!parsed.success || typeof body?.id !== "string")
    return fail("입력 항목을 확인해주세요.");
  const { data, error } = await c.db
    .from("campaigns")
    .update({ brief: parsed.data, status: parsed.data.status })
    .eq("id", body.id)
    .eq("owner_id", c.user.id)
    .select("id")
    .single();
  if (error || !data) return fail("수정할 수 없습니다.", 403);
  return NextResponse.json(data);
}
export async function DELETE(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const id = new URL(req.url).searchParams.get("id");
  const { data, error } = await c.db
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("owner_id", c.user.id)
    .select("id");
  if (error || !data?.length) return fail("삭제할 수 없습니다.", 403);
  return NextResponse.json({ ok: true });
}
