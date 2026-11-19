import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ proposalId: z.uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { error } = await c.db.from("proposal_reads").upsert({
    proposal_id: p.data.proposalId,
    user_id: c.user.id,
    last_read_at: new Date().toISOString(),
  });
  if (error) return fail("읽음 처리 권한이 없습니다.", 403);
  return NextResponse.json({ ok: true });
}
