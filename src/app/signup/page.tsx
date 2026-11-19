import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
export default function Signup() {
  return (
    <div className="auth">
      <span className="eyebrow">Create your account</span>
      <h1 style={{ marginTop: 20 }}>좋은 만남의 시작.</h1>
      <p>브랜드 또는 크리에이터로 함께하세요.</p>
      <AuthForm mode="signup" />
      <p style={{ marginTop: 24, fontSize: 13 }}>
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </p>
    </div>
  );
}
