import { NextResponse } from "next/server";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import {
  agreementError,
  agreementRequestSchema,
  agreementStateSchema,
} from "@/lib/agreements";

// D050: the database decides party, open status, contactability, expected version and idempotency;
// this route only validates shape and maps the stable error codes.
export const POST = apiRoute("agreements.post", async (req) => {
  const c = await requireContext();
  const b = await parseBody(
    req,
    agreementRequestSchema,
    "예산(원)·산출물·일정을 확인해주세요.",
  );
  const { data, error } =
    b.action === "propose"
      ? await c.db.rpc("agreement_propose", {
          p_proposal: b.proposalId,
          p_offer: b.offerId,
          p_expected: b.expectedVersion,
          p_terms: b.terms,
        })
      : await c.db.rpc("agreement_accept", {
          p_proposal: b.proposalId,
          p_offer: b.offerId,
          p_expected: b.expectedVersion,
        });
  const known = error && agreementError(error.message);
  if (known) fail(...known);
  if (error) failDatabase(error, "협업 조건을 저장하지 못했습니다.");
  const state = agreementStateSchema.safeParse(data);
  if (!state.success || state.data.proposalId !== b.proposalId)
    fail("협업 조건 응답을 확인하지 못했습니다.", 503);
  return NextResponse.json(
    { ok: true, state: state.data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
