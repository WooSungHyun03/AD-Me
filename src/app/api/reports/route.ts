import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
import { issuePayloadSchema } from "@/lib/reviews";
import { requireReviewResult } from "@/lib/review-server";
export const POST = apiRoute("reports.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    issuePayloadSchema.extend({
      creatorId: z.string().min(1).max(100),
      clientKey: z.uuid().optional(),
      evidenceKind: issuePayloadSchema.shape.evidenceKind.default("claim"),
    }),
    "10자 이상의 사유와 HTTPS 출처를 입력해주세요.",
  );
  const { data, error } = await c.db.rpc("review_submit", {
    p_kind: "issue",
    p_creator: p.creatorId,
    p_key: p.clientKey ?? randomUUID(),
    p_payload: {
      reason: p.reason,
      sourceUrl: p.sourceUrl,
      evidenceKind: p.evidenceKind,
    },
  });
  if (error) failDatabase(error, "신고를 저장하지 못했습니다.");
  requireReviewResult(data);
  return NextResponse.json(
    { ok: true, id: data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
