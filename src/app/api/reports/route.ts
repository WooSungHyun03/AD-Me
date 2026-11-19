import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      creatorId: z.string().max(100),
      reason: z.string().trim().min(10).max(2000),
      sourceUrl: z.url().refine((s) => s.startsWith("https://")),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("10자 이상의 사유와 HTTPS 출처를 입력해주세요.");
  const { error } = await c.db.from("reports").insert({
    reporter_id: c.user.id,
    creator_id: p.data.creatorId,
    reason: p.data.reason,
    source_url: p.data.sourceUrl,
  });
  if (error) return fail("신고를 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
}
