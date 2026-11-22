import Link from "next/link";
// D066: Toss redirects here with code/message (and orderId). Cancel vs failure is shown from the code;
// the provider message is untrusted query input, so it is length-limited and rendered as text.
const REASON: Record<string, string> = {
  PAY_PROCESS_CANCELED: "결제를 직접 취소했습니다.",
  PAY_PROCESS_ABORTED: "결제가 중단되었거나 진행되지 않았습니다.",
  REJECT_CARD_COMPANY: "카드사에서 결제를 거절했습니다.",
};
export default async function Fail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  const code = /^[A-Z_]{1,60}$/.test(p.code ?? "") ? p.code! : null;
  return (
    <section className="wrap">
      <h1 className="page-title">결제가 완료되지 않았습니다.</h1>
      <p data-testid="fail-reason">
        {(code && REASON[code]) ?? "결제 오류로 승인되지 않았습니다."} 이용권은
        활성화되지 않았고 요금이 청구되지 않습니다(TEST).
      </p>
      {code && (
        <p style={{ fontSize: 13, color: "var(--muted)" }}>
          오류 코드 {code}
          {p.message ? ` · ${p.message.slice(0, 200)}` : ""}
        </p>
      )}
      <Link className="button primary" href="/pricing">
        요금제로 돌아가기
      </Link>
    </section>
  );
}
