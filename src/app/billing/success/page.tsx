import { PaymentConfirm } from "@/components/payment-confirm";
import { notFound } from "next/navigation";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Success({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  if (getConfig().features.testBilling !== "enabled") notFound();
  const p = await searchParams;
  return (
    <section className="wrap prose">
      <h1 className="page-title">결제 인증 결과 확인</h1>
      <PaymentConfirm
        orderId={p.orderId ?? ""}
        paymentKey={p.paymentKey ?? ""}
        amount={Number(p.amount)}
      />
    </section>
  );
}
