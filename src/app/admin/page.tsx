import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { hasRecentAdminMfa } from "@/lib/admin-security";
import { supportScopes } from "@/lib/admin-support";
import { AdminSearch } from "@/components/admin-search";
import { AdminOperations } from "@/components/admin-operations";
export const dynamic = "force-dynamic";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const requested = Number((await searchParams).days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const c = await context();
  if (!c) redirect("/login");
  const { data: claims, error: claimsError } = await c.db.auth.getClaims(),
    { data: role, error: roleError } = await c.db.rpc("ops_current_role");
  if (
    claimsError ||
    claims?.claims.sub !== c.user.id ||
    !hasRecentAdminMfa(claims?.claims) ||
    roleError ||
    typeof role !== "string" ||
    !supportScopes[role]
  ) {
    const { data: eligible } = await c.db.rpc("ops_enrollment_role");
    if (eligible) redirect("/admin/security");
    return (
      <section className="wrap">
        <h1 className="page-title">관리자 권한이 필요합니다.</h1>
        <p>운영 데이터는 허가된 운영자에게만 공개됩니다.</p>
      </section>
    );
  }
  return (
    <section className="figma-width figma-workspace">
      <p className="figma-eyebrow">관리자 콘솔</p>
      <h1 className="page-title">서비스 운영 현황.</h1>
      <p>권한이 있는 자료를 검색하고 검토할 수 있습니다.</p>
      <nav className="figma-workspace-nav" aria-label="운영 메뉴">
        <a href="#admin-overview">운영 검색</a>
        {role === "super" && <Link href="/admin/reviews">근거 검토함</Link>}
        {role === "super" && <a href="#admin-operations">운영 패널</a>}
        <Link href="/admin/intelligence">수집·AI 운영 콘솔</Link>
        <Link href="/admin/security">OTP 다시 확인</Link>
      </nav>
      <div className="figma-workspace-panel" id="admin-overview">
        <AdminSearch role={role} />
      </div>
      {role === "super" && <AdminOperations db={c.db} days={days} />}
    </section>
  );
}
