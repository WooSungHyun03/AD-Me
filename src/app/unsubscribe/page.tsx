import { Unsubscribe } from "@/components/unsubscribe";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  return (
    <section className="wrap">
      <span className="eyebrow">Email</span>
      <h1 className="page-title">메일 수신 거부.</h1>
      <p>
        버튼을 누르면 이 메일 종류(서비스 알림 또는 마케팅)의 수신이 꺼집니다.
        회원가입 확인·비밀번호 재설정 같은 계정 보안 메일은 계속 발송될 수
        있습니다.
      </p>
      {t ? (
        <Unsubscribe token={t} />
      ) : (
        <p className="notice">수신거부 링크가 올바르지 않습니다.</p>
      )}
    </section>
  );
}
