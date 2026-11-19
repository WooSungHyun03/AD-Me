import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      proposalId: z.uuid(),
      body: z.string().trim().min(1).max(3000),
      kind: z.enum(["message", "deliverable"]),
      url: z.string().max(1000).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("메시지 입력을 확인해주세요.");
  if (
    p.data.kind === "deliverable" &&
    (!p.data.url ||
      !z.url().safeParse(p.data.url).success ||
      !p.data.url.startsWith("https://"))
  )
    return fail("HTTPS 결과물 링크를 입력해주세요.");
  const { error } = await c.db.from("messages").insert({
    proposal_id: p.data.proposalId,
    sender_id: c.user.id,
    body: p.data.body,
    kind: p.data.kind,
    url: p.data.url,
  });
  if (error)
    return fail("메시지를 저장할 권한이 없거나 저장에 실패했습니다.", 403);
  return NextResponse.json({ ok: true });
}
