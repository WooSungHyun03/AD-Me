import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { draftInput, draftResult } from "@/lib/intelligence";

export async function POST(request: Request) {
  if (!safeOrigin(request)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "brand")
    return fail("브랜드 계정에서 사용할 수 있습니다.", 403);
  const parsed = z
    .object({ brief: draftInput })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("기획 조건을 10~1600자로 입력해주세요.");
  const { data, error } = await c.db.rpc("ops_draft_create", {
    p_input: parsed.data.brief,
  });
  if (error?.code === "54000")
    return fail(
      "지금은 요청 한도에 도달했습니다. 잠시 후 다시 시도해주세요.",
      429,
    );
  if (error || !data) return fail("AI 작업을 접수하지 못했습니다.", 503);
  return NextResponse.json({ id: data }, { status: 202 });
}

export async function GET(request: Request) {
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return fail("작업 번호를 확인해주세요.");
  const { data, error } = await c.db.rpc("ops_draft_get", { p_id: id.data });
  if (error) return fail("작업 상태를 확인할 수 없습니다.", 503);
  if (!data) return fail("작업을 찾을 수 없습니다.", 404);
  const output = draftResult.safeParse(data.output);
  return NextResponse.json(
    {
      status: data.status,
      output: output.success ? output.data : null,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
