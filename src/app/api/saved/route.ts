import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
// Heart toggle = membership in the caller's default list (D036 migrated old favorites there).
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const b = await req.json().catch(() => null);
  if (typeof b?.creatorId !== "string" || b.creatorId.length > 100)
    return fail("잘못된 요청입니다.");
  const { data: listId, error: le } = await c.db.rpc("ensure_default_list");
  if (le) return fail("저장하지 못했습니다.", 500);
  const key = { list_id: listId, creator_id: b.creatorId };
  const { data: removed, error } = await c.db
    .from("saved_list_items")
    .delete()
    .match(key)
    .select("creator_id");
  if (error) return fail("저장하지 못했습니다.");
  if (removed?.length) return NextResponse.json({ saved: false });
  const ins = await c.db
    .from("saved_list_items")
    .insert({ ...key, owner_id: c.user.id });
  if (ins.error) return fail("저장하지 못했습니다.");
  return NextResponse.json({ saved: true });
}
