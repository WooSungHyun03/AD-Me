import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// D061: private selection review (checked items, memo, manual approval). The DB re-checks ownership and
// refuses an approval that does not cover every current checklist item.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      campaignId: z.uuid(),
      creatorId: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
      checked: z.array(z.uuid()).max(10),
      memo: z.string().max(1000),
      approve: z.boolean(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("입력값을 확인해주세요.");
  const { data, error } = await c.db.rpc("set_creator_review", {
    p_campaign: p.data.campaignId,
    p_creator: p.data.creatorId,
    p_checked: p.data.checked,
    p_memo: p.data.memo,
    p_approve: p.data.approve,
  });
  if (error)
    return error.message.includes("review_incomplete")
      ? fail("체크리스트를 모두 확인해야 승인할 수 있습니다.", 409)
      : fail("본인 캠페인의 후보만 검토할 수 있습니다.", 403);
  return NextResponse.json(data);
}
