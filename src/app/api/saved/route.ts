import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const b = await req.json().catch(() => null);
  if (typeof b?.creatorId !== "string" || b.creatorId.length > 100)
    return fail("잘못된 요청입니다.");
  const { data } = await c.db
    .from("saved_creators")
    .select("creator_id")
    .eq("owner_id", c.user.id)
    .eq("creator_id", b.creatorId)
    .maybeSingle();
  const result = data
    ? await c.db
        .from("saved_creators")
        .delete()
        .eq("owner_id", c.user.id)
        .eq("creator_id", b.creatorId)
    : await c.db
        .from("saved_creators")
        .insert({ owner_id: c.user.id, creator_id: b.creatorId });
  if (result.error) return fail("저장하지 못했습니다.");
  return NextResponse.json({ saved: !data });
}
