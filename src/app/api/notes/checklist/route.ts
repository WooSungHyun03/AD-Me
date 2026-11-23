import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// D061: the brand's own review checklist (RLS: owner only, brand role, max 10 items).
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ label: z.string().trim().min(1).max(100) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("항목은 1~100자로 입력해주세요.");
  const { error } = await c.db
    .from("review_checklist_items")
    .insert({ label: p.data.label });
  if (error)
    return fail(
      error.message.includes("checklist_full")
        ? "체크 항목은 10개까지입니다."
        : "브랜드 계정만 체크리스트를 만들 수 있습니다.",
      400,
    );
  return NextResponse.json({ ok: true });
}
export async function DELETE(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ id: z.uuid() })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { data } = await c.db
    .from("review_checklist_items")
    .delete()
    .eq("id", p.data.id)
    .select("id");
  if (!data?.length) return fail("항목을 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true });
}
