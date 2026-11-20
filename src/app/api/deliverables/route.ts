import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
} from "@/lib/api";
import {
  deliveryAttestSchema,
  deliveryCreateSchema,
  deliveryPageSchema,
} from "@/lib/deliverables";
export const GET = apiRoute("deliverables.get", async (req) => {
  const c = await requireContext();
  const q = parseInput(
    z.strictObject({
      proposalId: z.uuid(),
      beforeVersion: z.coerce.number().int().min(1).max(2147483647).optional(),
    }),
    Object.fromEntries(new URL(req.url).searchParams),
    "결과물 조회 항목을 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("delivery_page", {
    p_proposal: q.proposalId,
    p_before: q.beforeVersion ?? null,
    p_limit: 20,
  });
  if (error) failDatabase(error, "결과물을 불러오지 못했습니다.");
  const result = deliveryPageSchema.safeParse(data);
  if (!result.success || result.data.proposalId !== q.proposalId)
    fail("결과물 응답을 확인하지 못했습니다.", 503);
  return Response.json(result.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
export const POST = apiRoute("deliverables.post", async (req) => {
  const c = await requireContext();
  const p = await parseBody(
    req,
    deliveryCreateSchema,
    "결과물과 광고 표시 확인을 검토해주세요.",
  );
  const { data, error } = await c.db.rpc("delivery_create", {
    p_proposal: p.proposalId,
    p_expected: p.expectedVersion,
    p_key: p.clientKey,
    p_body: p.body,
    p_url: p.url,
    p_declaration: p.declaration,
  });
  if (error)
    failDatabase(
      error,
      "결과물을 저장하지 못했습니다. 최신 제출본을 확인해주세요.",
    );
  if (!z.uuid().safeParse(data).success)
    fail("결과물 저장 응답을 확인하지 못했습니다.", 503);
  return Response.json(
    { ok: true, id: data },
    { headers: { "Cache-Control": "no-store" } },
  );
});
export const PATCH = apiRoute("deliverables.attest", async (req) => {
  const c = await requireContext(),
    p = await parseBody(
      req,
      deliveryAttestSchema,
      "현재 제출본의 표시 확인을 검토해주세요.",
    );
  const { data, error } = await c.db.rpc("delivery_attest", {
    p_proposal: p.proposalId,
    p_submission: p.submissionId,
    p_expected: p.expectedVersion,
    p_declaration: p.declaration,
  });
  if (error)
    failDatabase(
      error,
      "확인을 저장하지 못했습니다. 최신 제출본을 확인해주세요.",
    );
  if (data !== true) fail("결과물 확인 응답을 확인하지 못했습니다.", 503);
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
});
