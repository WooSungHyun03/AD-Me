import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("restrict"),
    reportId: z.uuid(),
    days: z.union([z.literal(1), z.literal(7), z.literal(30)]),
    reason: z.string().trim().min(5).max(500),
  }),
  z.object({ action: z.literal("lift"), restrictionId: z.uuid() }),
]);
const errors: Record<string, string> = {
  no_account:
    "수집 프로필은 계정이 없어 연락 제한 대상이 아닙니다. 비공개 처리를 이용하세요.",
  invalid_days: "제한 기간은 1~30일입니다.",
  not_found: "이미 해제된 제한입니다.",
};
// Human decision only: temporary (≤30 days) restriction tied to a reviewed report, and lifting it.
 async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = body.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("제한 사유(5자 이상)와 기간을 확인해주세요.");
  const d = p.data;
  const { error } =
    d.action === "restrict"
      ? await c.db.rpc("restrict_contact", {
          p_report: d.reportId,
          p_days: d.days,
          p_reason: d.reason,
        })
      : await c.db.rpc("lift_restriction", { p_id: d.restrictionId });
  if (error)
    return fail(
      Object.entries(errors).find(([k]) => error.message.includes(k))?.[1] ??
        "처리하지 못했습니다.",
      409,
    );
  return NextResponse.json({ ok: true });
}

export const POST=compatibleApiRoute("src/app/api/admin/restrict/route.ts.POST",handlePOST);
