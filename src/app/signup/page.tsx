import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Signup() {
  const canSendMail = getConfig().features.mail === "enabled";
  return (
    <div className="auth">
      <span className="eyebrow">Create your account</span>
      <h1 style={{ marginTop: 20 }}>좋은 만남의 시작.</h1>
      <p>브랜드 또는 크리에이터로 함께하세요.</p>
      {canSendMail ? (
        <>
          <AuthForm mode="signup" />
          <p>
            <Link href="/signup/resend">가입 확인 메일 다시 받기</Link>
          </p>
        </>
      ) : (
        <p role="status" className="notice">
          가입 메일 서비스 연결을 준비 중입니다.
        </p>
      )}
      <p style={{ marginTop: 24, fontSize: 13 }}>
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </p>
    </div>
  );
}
