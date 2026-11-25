import Link from "next/link";
import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

const reasons: Readonly<Record<string, string>> = {
  PAY_PROCESS_CANCELED: "결제를 직접 취소했습니다.",
  REJECT_CARD_COMPANY: "카드사에서 결제를 거절했습니다.",
  PAY_PROCESS_ABORTED: "결제 오류로 승인되지 않았습니다.",
};

export default async function Fail({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  if (getConfig().features.testBilling !== "enabled") notFound();
  const { code } = await searchParams;
  const known = typeof code === "string" && Object.hasOwn(reasons, code);
  return (
    <section className="wrap">
      <h1 className="page-title">결제가 완료되지 않았습니다.</h1>
      <p data-testid="fail-reason">
        {known ? reasons[code] : "결제 오류로 승인되지 않았습니다."}
      </p>
      {known && <p>오류 코드 {code}</p>}
      <p>이용권은 활성화되지 않았습니다.</p>
      <Link className="button primary" href="/pricing">
        요금제로 돌아가기
      </Link>
    </section>
  );
}
