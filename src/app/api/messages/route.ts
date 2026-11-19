import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";

const messageFields = {
  proposalId: z.uuid(),
  body: z.string().trim().min(1).max(3000),
};
const httpsUrl = z.url({ protocol: /^https$/ }).max(1000);
const messageSchema = z.discriminatedUnion("kind", [
  z.object({
    ...messageFields,
    kind: z.literal("message"),
    url: z.union([z.literal(""), httpsUrl]).optional(),
  }),
  z.object({
    ...messageFields,
    kind: z.literal("deliverable"),
    url: httpsUrl,
  }),
]);
export const POST = apiRoute("messages.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    messageSchema,
    "메시지와 HTTPS 결과물 링크를 확인해주세요.",
  );
  const { error } = await c.db.from("messages").insert({
    proposal_id: p.proposalId,
    sender_id: c.user.id,
    body: p.body,
    kind: p.kind,
    url: p.url || undefined,
  });
  if (error) failDatabase(error, "메시지를 저장하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
