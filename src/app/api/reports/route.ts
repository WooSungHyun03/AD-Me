import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
export const POST = apiRoute("reports.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z.object({
      creatorId: z.string().min(1).max(100),
      reason: z.string().trim().min(10).max(2000),
      sourceUrl: z.url().refine((s) => s.startsWith("https://")),
    }),
    "10자 이상의 사유와 HTTPS 출처를 입력해주세요.",
  );
  const { error } = await c.db.from("reports").insert({
    reporter_id: c.user.id,
    creator_id: p.creatorId,
    reason: p.reason,
    source_url: p.sourceUrl,
  });
  if (error) failDatabase(error, "신고를 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
