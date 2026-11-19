import Link from "next/link";
import { EmailActionForm } from "@/components/email-action-form";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function ResendSignup() {
  const canSendMail = getConfig().features.mail === "enabled";
  return (
    <section className="auth">
      <h1>가입 확인 메일 다시 받기</h1>
      <p>가입할 때 입력한 이메일을 사용해주세요.</p>
      {canSendMail ? (
        <EmailActionForm mode="resend" />
      ) : (
        <p role="status" className="notice">
          가입 메일 서비스 연결을 준비 중입니다.
        </p>
      )}
      <p>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </section>
  );
}
