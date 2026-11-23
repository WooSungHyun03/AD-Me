import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";

export async function POST(request: Request) {
  if (!safeOrigin(request)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const body = z
    .object({
      id: z.uuid(),
      action: z.enum(["block", "unblock", "report"]),
      reason: z.string().trim().max(500).optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) return fail("요청 내용을 확인해주세요.");
  const { id, action, reason } = body.data;
  const { error } = await c.db.rpc("chat_control", {
    p_id: id,
    p_action: action,
    p_reason: reason ?? "",
  });
  if (error)
    return fail(
      "대화 권한과 신고 내용을 확인해주세요.",
      error.code === "42501" ? 403 : 400,
    );
  return NextResponse.json({ ok: true });
}
