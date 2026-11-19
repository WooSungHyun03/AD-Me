"use client";
import { useState } from "react";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { assertTestClient, type TestProduct } from "@/lib/billing";
import { Button } from "./ui/button";
export function Checkout({
  sku,
  clientKey,
  displayedAmount,
}: {
  sku: TestProduct["sku"];
  clientKey: string;
  displayedAmount: number;
}) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const key = assertTestClient(clientKey);
            const res = await fetch("/api/billing/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sku, expectedAmount: displayedAmount }),
            });
            const o = await res.json();
            if (!res.ok) throw new Error(o.error?.message || "주문 생성 실패");
            if (o.amount !== displayedAmount)
              throw new Error(
                "상품 금액이 변경되었습니다. 요금제를 새로고침해주세요.",
              );
            const toss = await loadTossPayments(key);
            await toss.payment({ customerKey: o.owner_id }).requestPayment({
              method: "CARD",
              amount: { currency: "KRW", value: o.amount },
              orderId: o.id,
              orderName: o.name,
              successUrl: location.origin + "/billing/success",
              failUrl: location.origin + "/billing/fail",
            });
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "결제창을 열지 못했습니다.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "결제창 준비 중…" : "TEST 이용권 선택"}
      </Button>
      {error && (
        <p
          role="alert"
          className="error"
          style={{ fontSize: 12, marginTop: 14 }}
        >
          {error}
        </p>
      )}
    </>
  );
}
