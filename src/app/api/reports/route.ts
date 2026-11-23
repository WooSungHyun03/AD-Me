import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { reportError } from "@/lib/schemas";
// All checks (rate limit, duplicates, appeal window, owner verification) run in submit_report.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      kind: z.enum([
        "report",
        "correction",
        "deletion",
        "appeal",
        "impersonation",
      ]),
      creatorId: z.string().max(100).default(""),
      reason: z.string().trim().min(10).max(2000),
      sourceUrl: z
        .union([z.literal(""), z.url().refine((s) => s.startsWith("https://"))])
        .optional(),
      parentId: z.uuid().optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success)
    return fail("요청 유형, 10자 이상의 사유, HTTPS 출처를 확인해주세요.");
  const { data, error } = await c.db.rpc("submit_report", {
    p_kind: p.data.kind,
    p_creator: p.data.creatorId,
    p_reason: p.data.reason,
    p_source_url: p.data.sourceUrl || null,
    p_parent: p.data.parentId ?? null,
  });
  if (error)
    return fail(
      reportError(error.message) ?? "요청을 접수하지 못했습니다.",
      409,
    );
  return NextResponse.json({ ok: true, ...data[0] }, { status: 201 });
}
