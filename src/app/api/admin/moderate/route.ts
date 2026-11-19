import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = z
    .object({
      id: z.string().min(1).max(100),
      kind: z.enum(["creator", "campaign"]),
      published: z.boolean(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { error } = await c.db.rpc("moderate_entity", {
    p_kind: p.data.kind,
    p_id: p.data.id,
    p_published: p.data.published,
  });
  if (error) return fail("운영 상태를 변경하지 못했습니다.");
  return NextResponse.json({ ok: true });
}
