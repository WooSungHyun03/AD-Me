import Link from "next/link";
export default function AuthError() {
  return (
    <section className="auth">
      <h1>인증을 완료하지 못했습니다</h1>
      <p>
        링크가 만료되었거나 이미 사용되었을 수 있습니다. 인증을 요청한
        브라우저에서 다시 시도해주세요.
      </p>
      <p>
        <Link href="/signup/resend">가입 확인 메일 다시 받기</Link>
      </p>
      <p>
        <Link href="/forgot-password">새 복구 메일 요청</Link>
      </p>
      <p>
        <Link href="/login">로그인으로 돌아가기</Link>
      </p>
    </section>
  );
}
