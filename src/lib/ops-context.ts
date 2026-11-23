import "server-only";
import { requireContext, fail, failDatabase } from "./api";
import { hasRecentAdminMfa } from "./admin-security";
import { supportScopes } from "./admin-support";
export async function requireSupportContext() {
  const c = await requireContext(),
    { data: claims, error } = await c.db.auth.getClaims();
  if (
    error ||
    claims?.claims.sub !== c.user.id ||
    !hasRecentAdminMfa(claims?.claims)
  )
    fail("운영자 OTP 재인증이 필요합니다.", 403);
  const { data: role, error: roleError } = await c.db.rpc("ops_current_role");
  if (roleError) failDatabase(roleError, "운영 권한을 확인하지 못했습니다.");
  if (typeof role !== "string" || !supportScopes[role])
    fail("운영 권한이 필요합니다.", 403);
  return { ...c, staffRole: role };
}
