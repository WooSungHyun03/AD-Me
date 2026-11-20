import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import { messageInputSchema } from "@/lib/conversation";
import {
  decodeConversationCursor,
  projectConversationPage,
} from "@/lib/conversation-server";

export const GET = apiRoute("messages.get", async (req) => {
  const c = await requireContext();
  const q = parseInput(
    z.strictObject({
      proposalId: z.uuid(),
      cursor: z.string().min(1).max(512).optional(),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
    Object.fromEntries(new URL(req.url).searchParams),
    "메시지 조회 항목을 확인해주세요.",
  );
  const cursor = decodeConversationCursor(q.cursor, q.proposalId);
  const { data, error } = await c.db.rpc("conversation_page", {
    p_proposal: q.proposalId,
    p_before_at: cursor?.createdAt ?? null,
    p_before_id: cursor?.id ?? null,
    p_limit: q.limit,
  });
  if (error) failDatabase(error, "메시지를 불러오지 못했습니다.");
  return NextResponse.json(projectConversationPage(data, q.proposalId), {
    headers: { "Cache-Control": "no-store" },
  });
});
export const POST = apiRoute("messages.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    messageInputSchema,
    "메시지와 HTTPS 결과물 링크를 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("conversation_send", {
    p_proposal: p.proposalId,
    p_key: p.clientKey ?? randomUUID(),
    p_body: p.body,
    p_kind: p.kind,
    p_url: p.url || null,
  });
  if (error) failDatabase(error, "메시지를 저장하지 못했습니다.");
  if (!z.uuid().safeParse(data).success)
    fail("메시지 응답을 확인하지 못했습니다.", 503);
  return NextResponse.json(
    { ok: true, id: data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
