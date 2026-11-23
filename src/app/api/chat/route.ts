import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
export const POST = apiRoute("chat.control", async (request) => {
  const c = await requireContext();
  const body = await parseBody(
    request,
    z.strictObject({
      id: z.uuid(),
      action: z.enum(["block", "unblock", "report"]),
      reason: z.string().trim().max(500).optional(),
    }),
    "요청 내용을 확인해주세요.",
  );
  const { error } = await c.db.rpc("chat_control", {
    p_id: body.id,
    p_action: body.action,
    p_reason: body.reason ?? "",
  });
  if (error) failDatabase(error, "대화 권한과 신고 내용을 확인해주세요.");
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
