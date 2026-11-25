import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
// Two compatible request shapes:
// - { proposalId }: legacy per-proposal message read marker (dashboard ReadButton).
// - { upto? }: D052 notification read cursor; the DB keeps it monotonic and clamps it
//   to the caller's newest notification, so retries and stale tabs never move it back.
const body = z.union([
  z.object({ proposalId: z.uuid() }).strict(),
  z.object({ upto: z.number().int().positive().optional() }).strict(),
]);
export const POST = apiRoute("read.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(req, body, "잘못된 요청입니다.");
  if ("proposalId" in p) {
    const { error } = await c.db.from("proposal_reads").upsert({
      proposal_id: p.proposalId,
      user_id: c.user.id,
      last_read_at: new Date().toISOString(),
    });
    if (error) failDatabase(error, "읽음 처리를 완료하지 못했습니다.");
    return NextResponse.json({ ok: true });
  }
  const { data, error } = await c.db.rpc("mark_notifications_read", {
    p_upto: p.upto ?? null,
  });
  if (error) failDatabase(error, "읽음 처리를 완료하지 못했습니다.");
  return NextResponse.json({ ok: true, lastReadId: data });
});
