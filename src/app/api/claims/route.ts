import { compatibleApiRoute } from "@/lib/api";
import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
// RPC error codes (supabase/migrations/20261123100004_claims.sql) → user messages.
const messages: Record<string, [string, number]> = {
  forbidden: ["크리에이터 계정만 청구할 수 있습니다.", 403],
  already_has_profile: [
    "이미 연결된 프로필이 있습니다. 한 계정은 한 프로필만 가질 수 있습니다.",
    409,
  ],
  not_claimable: [
    "청구할 수 없는 프로필입니다. 이미 인증되었거나 시연용입니다. 이의가 있으면 신고·정정 요청을 이용해주세요.",
    409,
  ],
  duplicate_claim: ["이미 진행 중인 청구가 있습니다.", 409],
  too_many_claims: ["진행 중인 청구가 너무 많습니다.", 429],
  not_pending: ["이미 처리된 청구입니다.", 409],
  already_owned: ["이미 다른 계정에 연결된 프로필입니다.", 409],
  code_mismatch: ["채널에서 확인한 코드가 청구 코드와 다릅니다.", 409],
  claimant_has_profile: ["청구자가 이미 다른 프로필을 가지고 있습니다.", 409],
};
const mapError = (msg = "") => {
  const key = Object.keys(messages).find((k) => msg.includes(k));
  return key
    ? fail(...messages[key])
    : fail("요청을 처리하지 못했습니다.", 500);
};
 async function handlePOST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ creatorId: z.string().min(1).max(100) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { data, error } = await c.db.rpc("start_claim", {
    p_creator: p.data.creatorId,
  });
  if (error) return mapError(error.message);
  // The plain code is shown once and never stored.
  return NextResponse.json({
    claimId: data[0].claim_id,
    code: data[0].code,
    expiresAt: data[0].expires_at,
  });
}
 async function handlePATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  if (c.role !== "admin") return fail("관리자 권한이 필요합니다.", 403);
  const p = z
    .object({
      claimId: z.uuid(),
      approve: z.boolean(),
      code: z.string().trim().max(40).optional(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { data, error } = await c.db.rpc("review_claim", {
    p_claim: p.data.claimId,
    p_approve: p.data.approve,
    p_code: p.data.code ?? null,
  });
  if (error) return mapError(error.message);
  return NextResponse.json({ status: data });
}

export const POST=compatibleApiRoute("src/app/api/claims/route.ts.POST",handlePOST);
export const PATCH=compatibleApiRoute("src/app/api/claims/route.ts.PATCH",handlePATCH);
