import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { draftInput, draftResult } from "@/lib/intelligence";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = apiRoute("intelligence.post", async (request) => {
  const c = await requireContext();
  if (c.role !== "brand")
    return fail("브랜드 계정에서 사용할 수 있습니다.", 403);
  const parsed = await parseBody(
    request,
    z.object({ brief: draftInput }).strict(),
    "기획 조건을 10~1600자로 입력해주세요.",
  );
  const { data, error } = await c.db.rpc("ops_draft_create", {
    p_input: parsed.brief,
  });
  if (error)
    failDatabase(
      error,
      "AI 작업을 접수하지 못했습니다. 권한과 요청 한도를 확인해주세요.",
    );
  if (!data) fail("AI 작업을 접수하지 못했습니다.", 503);
  return NextResponse.json({ id: data }, { status: 202 });
});

export const GET = apiRoute("intelligence.get", async (request) => {
  const c = await requireContext();
  const id = parseInput(
    z.uuid(),
    new URL(request.url).searchParams.get("id"),
    "작업 번호를 확인해주세요.",
  );
  await enforceRateLimit(c.db, "draft_poll");
  const { data, error } = await c.db.rpc("ops_draft_get", { p_id: id });
  if (error) failDatabase(error, "작업 상태를 확인할 수 없습니다.");
  if (!data) return fail("작업을 찾을 수 없습니다.", 404);
  const output = draftResult.safeParse(data.output);
  return NextResponse.json(
    {
      status: data.status,
      output: output.success ? output.data : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
