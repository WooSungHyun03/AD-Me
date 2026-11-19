import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
export async function PATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ name: z.string().trim().min(2).max(80) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("이름은 2~80자여야 합니다.");
  const { error } = await c.db
    .from("profiles")
    .update({ name: p.data.name })
    .eq("id", c.user.id);
  if (error) return fail("이름을 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
}
