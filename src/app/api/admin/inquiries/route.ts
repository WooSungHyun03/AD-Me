import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// D063: admin answers or closes an inquiry (the DB re-checks the admin role).
 async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ id: z.uuid(), answer: z.string().max(2000), close: z.boolean() })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("입력값을 확인해주세요.");
  const { error } = await c.db.rpc("answer_inquiry", {
    p_id: p.data.id,
    p_answer: p.data.answer,
    p_close: p.data.close,
  });
  if (error)
    return error.message.includes("forbidden")
      ? fail("관리자 권한이 필요합니다.", 403)
      : fail(
          "답변 내용을 입력했는지, 이미 종료된 문의가 아닌지 확인해주세요.",
          409,
        );
  return NextResponse.json({ ok: true });
}

export const POST=compatibleApiRoute("src/app/api/admin/inquiries/route.ts.POST",handlePOST);
