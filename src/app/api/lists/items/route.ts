import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
const item = z.object({
  listId: z.uuid(),
  creatorId: z.string().min(1).max(100),
});
async function parse(req: Request) {
  if (!safeOrigin(req)) return { err: fail("허용되지 않은 요청입니다.", 403) };
  const c = await context();
  if (!c) return { err: fail("로그인이 필요합니다.", 401) };
  const p = item.safeParse(await req.json().catch(() => null));
  if (!p.success) return { err: fail("잘못된 요청입니다.") };
  return { c, d: p.data };
}
export async function POST(req: Request) {
  const { c, d, err } = await parse(req);
  if (!c) return err;
  const { error } = await c.db
    .from("saved_list_items")
    .insert({
      list_id: d.listId,
      creator_id: d.creatorId,
      owner_id: c.user.id,
    });
  if (error?.message.includes("duplicate key"))
    return fail("이미 이 그룹에 있는 크리에이터입니다.", 409);
  if (error) return fail("그룹에 추가하지 못했습니다.", 403);
  return NextResponse.json({ ok: true }, { status: 201 });
}
export async function DELETE(req: Request) {
  const { c, d, err } = await parse(req);
  if (!c) return err;
  const { data, error } = await c.db
    .from("saved_list_items")
    .delete()
    .match({ list_id: d.listId, creator_id: d.creatorId })
    .select("creator_id");
  if (error || !data.length) return fail("삭제할 항목이 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
