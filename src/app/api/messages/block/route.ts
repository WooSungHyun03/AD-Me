import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
export const POST = apiRoute("messages.block", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z.strictObject({ proposalId: z.uuid(), blocked: z.boolean() }),
    "차단 항목을 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("conversation_block", {
    p_proposal: p.proposalId,
    p_blocked: p.blocked,
  });
  if (error) failDatabase(error, "대화 차단을 변경하지 못했습니다.");
  if (typeof data !== "boolean") fail("차단 응답을 확인하지 못했습니다.", 503);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
});
