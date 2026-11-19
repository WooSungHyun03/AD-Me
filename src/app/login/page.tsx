import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
export default function Login() {
  return (
    <div className="auth">
      <span className="eyebrow">Welcome back</span>
      <h1 style={{ marginTop: 20 }}>다음 협업을 이어가세요.</h1>
      <p>AD Me 워크스페이스에 로그인하세요.</p>
      <AuthForm mode="login" />
      <p style={{ marginTop: 24, fontSize: 13 }}>
        처음이신가요? <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
