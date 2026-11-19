import Link from "next/link";
import { EmailActionForm } from "@/components/email-action-form";
export default function ForgotPassword() {
  return (
    <section className="auth">
      <span className="eyebrow">Account recovery</span>
      <h1>비밀번호 찾기</h1>
      <p>
        가입한 이메일로 복구 링크를 요청하세요. 링크의 안내에 따라 새 비밀번호를
        설정할 수 있습니다.
      </p>
      <EmailActionForm mode="request" />
      <p>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </section>
  );
}
