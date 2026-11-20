import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { AdminMfaForm } from "@/components/admin-mfa-form";
export const dynamic = "force-dynamic";

export default async function AdminSecurity() {
  const c = await context();
  if (!c) redirect("/login");
  const { data: provisioned, error } = await c.db.rpc("ops_enrollment_role");
  if (error || typeof provisioned !== "string")
    return (
      <section className="wrap">
        <h1 className="page-title">관리자 초대를 확인해주세요.</h1>
        <p>
          만료되지 않은 운영자 승인이 필요합니다. 운영 담당자에게 문의해주세요.
        </p>
      </section>
    );
  const { data, error: factorError } = await c.db.auth.mfa.listFactors();
  return (
    <section className="wrap" style={{ maxWidth: 640 }}>
      <span className="eyebrow">Admin security</span>
      <h1 className="page-title">관리자 OTP 확인.</h1>
      <p>
        운영 정보 접근과 조치에는 OTP 인증이 필요합니다. 인증은 15분 동안
        유효하며, 초대가 철회되면 즉시 접근을 중단합니다.
      </p>
      {factorError ? (
        <p role="alert">
          인증 수단을 불러오지 못했습니다. 페이지를 새로고침해주세요.
        </p>
      ) : (
        <AdminMfaForm
          factorId={
            data?.totp.find((factor) => factor.status === "verified")?.id ??
            null
          }
        />
      )}
      <Link href="/dashboard">워크스페이스로 돌아가기</Link>
    </section>
  );
}
