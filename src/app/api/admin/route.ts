import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { reportError } from "@/lib/schemas";
import { z } from "zod";
import { storageAdmin } from "@/lib/uploads";
import { snapshotAfterDeletion } from "@/lib/privacy-retention";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = z
    .object({
      id: z.uuid(),
      status: z.enum(["in_review", "resolved", "dismissed"]),
      response: z.string().trim().max(2000).optional(),
      hide: z.boolean().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { error } = await c.db.rpc("review_report", {
    p_id: p.data.id,
    p_status: p.data.status,
    p_response: p.data.response || null,
    p_hide: p.data.hide ?? null,
  });
  if (error)
    return fail(reportError(error.message) ?? "검토 처리에 실패했습니다.", 409);
  if (p.data.status === "resolved") await snapshotAfterDeletion(storageAdmin());
  return NextResponse.json({ ok: true });
}
