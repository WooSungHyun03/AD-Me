import Link from "next/link";
import { EmailActionForm } from "@/components/email-action-form";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function ForgotPassword() {
  const canSendMail = getConfig().features.mail === "enabled";
  return (
    <section className="auth">
      <h1>비밀번호 찾기</h1>
      <p>
        가입한 이메일로 복구 링크를 요청하세요. 링크의 안내에 따라 새 비밀번호를
        설정할 수 있습니다.
      </p>
      {canSendMail ? (
        <EmailActionForm mode="request" />
      ) : (
        <p role="status" className="notice">
          복구 메일 서비스 연결을 준비 중입니다.
        </p>
      )}
      <p>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </section>
  );
}
