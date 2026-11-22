import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; reauth?: string }>;
}) {
  const { error, next, reauth } = await searchParams;
  return (
    <div className="auth">
      <span className="eyebrow">Welcome back</span>
      <h1 style={{ marginTop: 20 }}>다음 협업을 이어가세요.</h1>
      <p>AD Me 워크스페이스에 로그인하세요.</p>
      {error === "link" && (
        <p role="alert" className="error">
          링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.
        </p>
      )}
      {reauth && <p role="status">보안을 위해 비밀번호를 다시 확인해주세요.</p>}
      <AuthForm mode="login" next={next} />
      <p style={{ marginTop: 24, fontSize: 13 }}>
        <Link href="/auth/forgot">비밀번호를 잊으셨나요?</Link> · 처음이신가요?{" "}
        <Link href="/signup">회원가입</Link>
      </p>
    </div>
  );
}
