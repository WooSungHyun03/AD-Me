import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { storageAdmin } from "@/lib/uploads";
import { inquiryCategories as CATEGORIES } from "@/lib/schemas";
// D063: help/contact intake. Logged-in users are answered in /help; others leave a reply email.
// Written server-side only (table has no client writes); limits live in submit_inquiry().
const schema = z.object({
  category: z.enum(Object.keys(CATEGORIES) as [keyof typeof CATEGORIES]),
  message: z.string().trim().min(10).max(2000),
  email: z.union([z.literal(""), z.email().max(254)]).optional(),
});
 async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const p = schema.safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("문의 유형과 10자 이상의 내용을 입력해주세요.");
  const c = await context();
  if (!c && !p.data.email)
    return fail("로그인하지 않았다면 답변받을 이메일을 입력해주세요.");
  const admin = storageAdmin();
  if (!admin)
    return fail(
      "문의 접수가 일시적으로 불가합니다. 잠시 후 다시 시도해주세요.",
      503,
    );
  const { data, error } = await admin.rpc("submit_inquiry", {
    p_user: c?.user.id ?? null,
    p_email: c ? "" : p.data.email,
    p_category: p.data.category,
    p_message: p.data.message,
  });
  if (error)
    return error.message.includes("rate_limited")
      ? fail("짧은 시간에 문의가 많습니다. 잠시 후 다시 시도해주세요.", 429)
      : fail("문의를 저장하지 못했습니다.", 400);
  return NextResponse.json({ id: data }, { status: 201 });
}

export const POST=compatibleApiRoute("src/app/api/inquiries/route.ts.POST",handlePOST);
