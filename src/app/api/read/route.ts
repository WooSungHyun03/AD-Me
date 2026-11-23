import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
export const POST = apiRoute("read.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    z.object({ proposalId: z.uuid() }),
    "잘못된 요청입니다.",
  );
  const { error } = await c.db.from("proposal_reads").upsert({
    proposal_id: p.proposalId,
    user_id: c.user.id,
    last_read_at: new Date().toISOString(),
  });
  if (error) failDatabase(error, "읽음 처리를 완료하지 못했습니다.");
  return NextResponse.json({ ok: true });
});
