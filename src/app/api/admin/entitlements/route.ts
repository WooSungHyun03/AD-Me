import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// D069: admin manual grant (reason required) and revoke/recover. The DB re-checks the admin role and limits.
const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("grant"),
    owner: z.uuid(),
    sku: z.string().regex(/^[a-z_]{1,40}$/),
    days: z.number().int().min(1).max(90),
    credits: z.number().int().min(0).max(1000),
    note: z.string().trim().min(5).max(300),
  }),
  z.object({
    action: z.literal("revoke"),
    id: z.uuid(),
    note: z.string().trim().min(5).max(300),
  }),
]);
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success)
    return fail("입력값을 확인해주세요. 사유는 5자 이상이어야 합니다.");
  const d = p.data;
  const { error } =
    d.action === "grant"
      ? await c.db.rpc("admin_grant_entitlement", {
          p_owner: d.owner,
          p_sku: d.sku,
          p_days: d.days,
          p_credits: d.credits,
          p_note: d.note,
        })
      : await c.db.rpc("revoke_entitlement", { p_id: d.id, p_reason: d.note });
  if (error)
    return error.message.includes("forbidden")
      ? fail("관리자 권한이 필요합니다.", 403)
      : fail(
          error.message.includes("invalid_grant")
            ? "상품과 회원 역할이 맞지 않거나 기간·크레딧 범위를 벗어났습니다."
            : "처리할 수 없습니다. 이미 회수된 이용권인지 확인해주세요.",
          409,
        );
  return NextResponse.json({ ok: true });
}
