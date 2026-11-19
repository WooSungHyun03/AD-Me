import Link from "next/link";
import { EmailActionForm } from "@/components/email-action-form";
import { emailProofSchema } from "@/lib/auth-links";
export const dynamic = "force-dynamic";
export default async function Confirm({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const input = await searchParams;
  const parsed = emailProofSchema.safeParse(input);
  if (!parsed.success)
    return (
      <section className="auth">
        <h1>인증 링크를 확인해주세요</h1>
        <p role="alert">유효한 이메일 인증 또는 복구 링크가 필요합니다.</p>
        <Link href="/forgot-password">새 복구 메일 요청</Link>
        <p>
          <Link href="/login">로그인으로 돌아가기</Link>
        </p>
      </section>
    );
  const recovery = parsed.data.type === "recovery";
  return (
    <section className="auth">
      <h1>{recovery ? "새 비밀번호 설정" : "이메일 인증"}</h1>
      <p>
        {recovery
          ? "이메일로 받은 복구 링크를 사용해 10자 이상의 새 비밀번호를 입력하세요."
          : "아래 버튼을 누르면 이메일 인증을 완료합니다. 페이지를 열기만 하면 인증 링크는 사용되지 않습니다."}
      </p>
      <EmailActionForm
        mode={recovery ? "reset" : "confirm"}
        tokenHash={parsed.data.token_hash}
        proofType={parsed.data.type}
      />
      <p>
        <Link href="/forgot-password">새 복구 메일 요청</Link>
      </p>
    </section>
  );
}
