import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
import { FigmaAuthShell } from "@/components/figma-auth-shell";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; reauth?: string }>;
}) {
  const { error, next, reauth } = await searchParams;
  return (
    <FigmaAuthShell>
      <h1>반가워요, 다시 함께해요.</h1>
      <p>우리의 다음 협업이 기다리고 있어요.</p>
      {error === "link" && (
        <p role="alert" className="error">
          링크가 만료되었거나 이미 사용되었습니다. 다시 요청해주세요.
        </p>
      )}
      {reauth && <p role="status">보안을 위해 비밀번호를 다시 확인해주세요.</p>}
      {error === "logout" && (
        <p role="alert" className="error">
          로그아웃을 완료하지 못했습니다. 연결을 확인하고 워크스페이스에서 다시
          시도해주세요.
        </p>
      )}
      <AuthForm mode="login" next={next} />
      <p style={{ marginTop: 24, fontSize: 13 }}>
        <Link href="/forgot-password">비밀번호를 잊으셨나요?</Link> ·
        처음이신가요? <Link href="/signup">회원가입</Link>
      </p>
    </FigmaAuthShell>
  );
}
