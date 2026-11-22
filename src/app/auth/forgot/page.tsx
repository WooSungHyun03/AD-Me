import Link from "next/link";
import { ForgotForm } from "@/components/account-auth-forms";
export default function Forgot() {
  return (
    <div className="auth">
      <span className="eyebrow">Reset password</span>
      <h1 style={{ marginTop: 20 }}>비밀번호를 다시 설정하세요.</h1>
      <p>가입한 이메일로 일회용 재설정 링크를 보내드립니다.</p>
      <ForgotForm />
      <p style={{ marginTop: 24, fontSize: 13 }}>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </div>
  );
}
