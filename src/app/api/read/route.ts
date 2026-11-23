import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// Moves the caller's notification read cursor forward (DB keeps it monotonic and clamps it).
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ upto: z.number().int().positive().optional() })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { data, error } = await c.db.rpc("mark_notifications_read", {
    p_upto: p.data.upto ?? null,
  });
  if (error) return fail("읽음 처리에 실패했습니다.", 500);
  return NextResponse.json({ ok: true, lastReadId: data });
}
