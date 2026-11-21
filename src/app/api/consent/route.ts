import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, failDatabase, parseBody, requireContext } from "@/lib/api";
import { policyDocument } from "@/lib/consent";
export const GET = apiRoute("consent.history", async () => {
  const c = await requireContext(),
    result = await c.db.rpc("my_consent_history_v2");
  if (result.error)
    failDatabase(result.error, "확인 기록을 불러오지 못했습니다.");
  return NextResponse.json(
    { items: result.data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
export const POST = apiRoute("consent.publication", async (req) => {
  const c = await requireContext(),
    p = await parseBody(
      req,
      z.strictObject({
        requestKey: z.uuid(),
        accepted: z.boolean(),
        purpose: z.literal("profile_publication"),
      }),
      "공개 선택 항목을 확인해주세요.",
    );
  const { data, error } = await c.db.rpc("record_publication_consent_v2", {
    p_version: policyDocument.version,
    p_hash: policyDocument.documentHash,
    p_accept: p.accepted,
    p_key: p.requestKey,
  });
  if (error) failDatabase(error, "공개 선택을 저장하지 못했습니다.");
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
