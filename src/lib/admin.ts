import "server-only";
import { fail, failDatabase, requireContext } from "./api";
import { hasRecentAdminMfa } from "./admin-security";

export async function requireProvisionedAdmin() {
  const c = await requireContext();
  if (c.role !== "admin") fail("관리자 권한이 필요합니다.", 403);
  const { data, error } = await c.db.rpc("is_admin_provisioned");
  if (error) failDatabase(error, "관리자 권한을 확인하지 못했습니다.");
  if (data !== true) fail("관리자 초대가 없거나 만료되었습니다.", 403);
  return c;
}

// Delegated operations staff may enroll OTP, but never gain classic admin powers.
export async function requireMfaEnrollmentContext() {
  const c = await requireContext();
  if (c.role === "admin") return requireProvisionedAdmin();
  const { data, error } = await c.db.rpc("ops_enrollment_role");
  if (error) failDatabase(error, "운영자 초대를 확인하지 못했습니다.");
  if (typeof data !== "string") fail("유효한 운영자 초대가 필요합니다.", 403);
  return c;
}

export async function requireAdminContext() {
  const c = await requireProvisionedAdmin();
  const { data, error } = await c.db.auth.getClaims();
  if (error && (error.status === 0 || (error.status ?? 0) >= 500))
    fail("인증 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.", 503);
  if (
    error ||
    data?.claims.sub !== c.user.id ||
    !hasRecentAdminMfa(data?.claims)
  )
    fail(
      "관리자 보안 설정에서 OTP를 다시 확인해주세요. 인증은 15분 동안 유효합니다.",
      403,
    );
  // The database repeats this check using the actual request JWT and current grant.
  const { data: allowed, error: checkError } = await c.db.rpc("is_admin");
  if (checkError)
    failDatabase(checkError, "관리자 보안 상태를 확인하지 못했습니다.");
  if (allowed !== true) fail("관리자 OTP 재인증이 필요합니다.", 403);
  return c;
}
