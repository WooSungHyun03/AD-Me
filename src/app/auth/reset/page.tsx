import { cookies } from "next/headers";
import Link from "next/link";
import { ResetForm } from "@/components/account-auth-forms";
import { RECOVERY_COOKIE } from "@/lib/auth-links";
import { currentUser } from "@/lib/supabase";
export default async function Reset() {
  const user = await currentUser();
  const marker = (await cookies()).get(RECOVERY_COOKIE)?.value;
  const valid = Boolean(user && marker === user.id);
  return (
    <div className="auth">
      <span className="eyebrow">New password</span>
      <h1 style={{ marginTop: 20 }}>새 비밀번호를 입력하세요.</h1>
      {valid ? (
        <>
          <p>
            {user!.email} 계정의 비밀번호를 변경합니다. 다른 기기는
            로그아웃됩니다.
          </p>
          <ResetForm />
        </>
      ) : (
        <p role="alert" className="error">
          재설정 링크가 만료되었거나 이미 사용되었습니다.{" "}
          <Link href="/auth/forgot">다시 요청하기</Link>
        </p>
      )}
    </div>
  );
}
