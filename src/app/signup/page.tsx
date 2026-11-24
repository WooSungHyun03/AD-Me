import { AuthForm } from "@/components/auth-form";
import Link from "next/link";
import { FigmaAuthShell } from "@/components/figma-auth-shell";
import { getConfig } from "@/lib/config";
import { configured, supabase } from "@/lib/supabase";
import { readCurrentPolicy, type PolicyStatus } from "@/lib/consent";

export const dynamic = "force-dynamic";

export default async function Signup() {
  const canSendMail = getConfig().features.mail === "enabled";
  let policy: PolicyStatus | null = null;
  if (canSendMail && configured()) {
    try {
      policy = await readCurrentPolicy(await supabase());
    } catch {
      /* Closed until the reviewed policy is available. */
    }
  }
  return (
    <FigmaAuthShell>
      <h1>처음 만나는 가능성.</h1>
      <p>브랜드 또는 크리에이터로 함께하세요.</p>
      <p>
        만 19세 이상 성인 베타입니다. 아래 확인은 실제 연령·신원 검증이 아니며
        생년월일·주민등록번호·신분증은 받지 않습니다.
      </p>
      {canSendMail && policy?.approved ? (
        <>
          <AuthForm mode="signup" policy={policy} />
          <p>
            <Link href="/signup/resend">가입 확인 메일 다시 받기</Link>
          </p>
        </>
      ) : (
        <p role="status" className="notice">
          {canSendMail
            ? "이용약관·개인정보 정책을 검토 중입니다. 승인된 정책이 준비되면 가입할 수 있습니다."
            : "가입 메일 서비스 연결을 준비 중입니다."}
        </p>
      )}
      <p style={{ marginTop: 24, fontSize: 13 }}>
        이미 계정이 있나요? <Link href="/login">로그인</Link>
      </p>
    </FigmaAuthShell>
  );
}
