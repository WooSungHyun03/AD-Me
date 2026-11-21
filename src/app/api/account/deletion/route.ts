import {
  apiRoute,
  parseBody,
  requireContext,
  fail,
  failDatabase,
} from "@/lib/api";
import {
  deletionRequestSchema,
  readDeletionStatus,
} from "@/lib/deletion-runtime";
import { deletionAdmin } from "@/lib/deletion-http";
import { verifyDeletionPassword } from "@/lib/deletion-reauth";
export const runtime = "nodejs";
export const POST = apiRoute("deletion.request", async (req) => {
  const body = await parseBody(
    req,
    deletionRequestSchema,
    "비밀번호와 삭제 요청 확인을 입력해주세요.",
  );
  const admin = await deletionAdmin(body.id),
    existing = await readDeletionStatus(admin, body);
  if (existing)
    return Response.json(existing, {
      headers: { "Cache-Control": "private, no-store" },
    });
  const c = await requireContext();
  if (!c.user.email) fail("지원 창구로 권리 요청을 접수해주세요.", 422);
  const attempt = await admin.rpc("deletion_attempt", { p_actor: c.user.id });
  if (attempt.error)
    failDatabase(attempt.error, "재인증 요청 한도에 도달했습니다.");
  let proof: Awaited<ReturnType<typeof verifyDeletionPassword>>;
  try {
    proof = await verifyDeletionPassword(
      c.user.id,
      c.user.email,
      body.password,
      body.code,
    );
  } catch {
    fail("현재 비밀번호와 등록된 인증 앱 코드를 확인해주세요.", 403);
  }
  const accepted = await admin.rpc("deletion_accept", {
    p_actor: c.user.id,
    p_id: body.id,
    p_receipt: body.receipt,
    p_reauth: proof.at,
  });
  // Clear all refresh sessions with the verified fresh session; access JWTs need the independent DB/Storage gate.
  if (accepted.error) {
    await admin.auth.admin.signOut(proof.token, "local");
    failDatabase(accepted.error, "계정 삭제 요청을 접수하지 못했습니다.");
  }
  await admin.auth.admin.signOut(proof.token, "global");
  const state = await readDeletionStatus(admin, body);
  if (!state) fail("접수 상태를 확인하지 못했습니다.", 503);
  return Response.json(state, {
    status: 202,
    headers: { "Cache-Control": "private, no-store" },
  });
});
