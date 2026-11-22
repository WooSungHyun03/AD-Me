import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
const name = z.string().trim().min(1).max(60);
const dbError = (msg = "") =>
  msg.includes("duplicate key")
    ? fail("같은 이름의 그룹이나 이 캠페인의 후보 목록이 이미 있습니다.", 409)
    : msg.includes("row-level security")
      ? fail("본인 캠페인에만 후보 목록을 만들 수 있습니다.", 403)
      : msg.includes("default_list_locked")
        ? fail("기본 목록은 삭제할 수 없습니다.", 409)
        : fail("그룹을 저장하지 못했습니다.", 500);
async function guard(req: Request) {
  if (!safeOrigin(req)) return { err: fail("허용되지 않은 요청입니다.", 403) };
  const c = await context();
  if (!c) return { err: fail("로그인이 필요합니다.", 401) };
  return { c };
}
export async function POST(req: Request) {
  const { c, err } = await guard(req);
  if (!c) return err;
  const p = z
    .object({ name, campaignId: z.uuid().optional() })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("그룹 이름을 확인해주세요.");
  // Ownership of campaignId is enforced by RLS (lists_own with check), not here.
  const { data, error } = await c.db
    .from("saved_lists")
    .insert({
      owner_id: c.user.id,
      name: p.data.name,
      campaign_id: p.data.campaignId ?? null,
    })
    .select("id")
    .single();
  if (error) return dbError(error.message);
  return NextResponse.json(data, { status: 201 });
}
export async function PATCH(req: Request) {
  const { c, err } = await guard(req);
  if (!c) return err;
  const p = z
    .object({ id: z.uuid(), name })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("그룹 이름을 확인해주세요.");
  const { data, error } = await c.db
    .from("saved_lists")
    .update({ name: p.data.name })
    .eq("id", p.data.id)
    .select("id");
  if (error) return dbError(error.message);
  if (!data.length) return fail("그룹을 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: Request) {
  const { c, err } = await guard(req);
  if (!c) return err;
  const id = z.uuid().safeParse(new URL(req.url).searchParams.get("id"));
  if (!id.success) return fail("잘못된 요청입니다.");
  const { data, error } = await c.db
    .from("saved_lists")
    .delete()
    .eq("id", id.data)
    .select("id");
  if (error) return dbError(error.message);
  if (!data.length) return fail("그룹을 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
