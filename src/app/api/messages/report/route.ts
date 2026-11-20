import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
export const POST = apiRoute("messages.report", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z.strictObject({
      messageId: z.uuid(),
      reason: z.string().trim().min(10).max(2000),
    }),
    "10자 이상의 신고 사유를 입력해주세요.",
  );
  const { data, error } = await c.db.rpc("conversation_report", {
    p_message: p.messageId,
    p_reason: p.reason,
  });
  if (error) failDatabase(error, "메시지 신고를 저장하지 못했습니다.");
  if (!z.uuid().safeParse(data).success)
    fail("신고 응답을 확인하지 못했습니다.", 503);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
});
