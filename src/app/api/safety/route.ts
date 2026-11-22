import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("block"), proposalId: z.uuid() }),
  z.object({ action: z.literal("unblock"), userId: z.uuid() }),
  z.object({
    action: z.literal("appeal"),
    restrictionId: z.uuid(),
    text: z.string().trim().min(10).max(2000),
  }),
]);
// Block (from a shared collaboration), unblock (own list), appeal own contact restriction.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success)
    return fail("입력을 확인해주세요. 이의신청 사유는 10자 이상입니다.");
  const d = p.data;
  const { error } =
    d.action === "block"
      ? await c.db.rpc("block_counterparty", { p_proposal: d.proposalId })
      : d.action === "unblock"
        ? await c.db.rpc("unblock_user", { p_user: d.userId })
        : await c.db.rpc("appeal_restriction", {
            p_id: d.restrictionId,
            p_text: d.text,
          });
  if (error)
    return fail(
      error.message.includes("appeal_closed")
        ? "이미 이의신청했거나 종료된 제한입니다."
        : "요청을 처리할 수 없습니다.",
      error.message.includes("appeal_closed") ? 409 : 403,
    );
  return NextResponse.json({ ok: true });
}
