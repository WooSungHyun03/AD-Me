import Link from "next/link";
export default function ResetPassword() {
  return (
    <section className="auth">
      <h1>이메일 복구 링크가 필요합니다</h1>
      <p>
        로그인 상태만으로 비밀번호를 재설정할 수 없습니다. 복구 메일의 링크를
        열어 변경해주세요.
      </p>
      <Link className="button primary" href="/forgot-password">
        복구 메일 요청
      </Link>
    </section>
  );
}
