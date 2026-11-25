import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { issuePayloadSchema } from "@/lib/reviews";
import { requireReviewResult } from "@/lib/review-server";
import { reportError } from "@/lib/schemas";

// D058 request queue (ticket number, deadline, interim hide, appeal) and D057 evidence review share one
// intake. A request kind selects the D058 queue; without one the D057 evidence review is used unchanged.
const requestSchema = z
  .strictObject({
    kind: z.enum([
      "report",
      "correction",
      "deletion",
      "impersonation",
      "appeal",
    ]),
    creatorId: z.string().max(100).default(""),
    reason: z.string().trim().min(10).max(2000),
    sourceUrl: z
      .union([z.literal(""), z.url().refine((s) => s.startsWith("https://"))])
      .optional(),
    parentId: z.uuid().optional(),
  })
  .refine((r) =>
    r.kind === "appeal" ? Boolean(r.parentId) : Boolean(r.creatorId),
  );
const requestResultSchema = z
  .array(z.object({ id: z.uuid(), ticket_no: z.string(), due_at: z.string() }))
  .length(1);
const evidenceSchema = issuePayloadSchema.extend({
  creatorId: z.string().min(1).max(100),
  clientKey: z.uuid().optional(),
  evidenceKind: issuePayloadSchema.shape.evidenceKind.default("claim"),
});

export const POST = apiRoute("reports.post", async (req) => {
  const c = await requireContext();
  const body = await parseBody(req, z.unknown(), "요청 내용을 확인해주세요.");
  if (body && typeof body === "object" && "kind" in body) {
    const r = parseInput(
      requestSchema,
      body,
      "요청 유형, 10자 이상의 사유, HTTPS 출처를 확인해주세요.",
    );
    // Rate limit, duplicates, appeal window and owner verification all run in submit_report.
    const { data, error } = await c.db.rpc("submit_report", {
      p_kind: r.kind,
      p_creator: r.creatorId,
      p_reason: r.reason,
      p_source_url: r.sourceUrl || null,
      p_parent: r.parentId ?? null,
    });
    const known = error && reportError(error.message);
    if (known) fail(known, 409);
    if (error) failDatabase(error, "요청을 접수하지 못했습니다.");
    const result = requestResultSchema.safeParse(data);
    if (!result.success) fail("접수 응답을 확인하지 못했습니다.", 503);
    const [row] = result.data;
    return NextResponse.json(
      { ok: true, id: row.id, ticketNo: row.ticket_no, dueAt: row.due_at },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }
  const p = parseInput(
    evidenceSchema,
    body,
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
