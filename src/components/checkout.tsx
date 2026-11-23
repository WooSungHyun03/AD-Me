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
        className="checkout-button"
        type="button"
        aria-busy={pending}
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
            if (!res.ok) {
              const message = {
                401: "로그인한 뒤 이용권을 선택해 주세요.",
                403: "이 계정에서는 이 이용권을 구매할 수 없습니다.",
                409: "상품 정보가 변경되었습니다. 요금제를 새로고침해 주세요.",
                429: "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
              }[res.status];
              setError(
                message ??
                  "현재 결제를 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.",
              );
              return;
            }
            const o = await res.json();
            if (o.amount !== displayedAmount) {
              setError(
                "상품 금액이 변경되었습니다. 요금제를 새로고침해 주세요.",
              );
              return;
            }
            const toss = await loadTossPayments(key);
            await toss.payment({ customerKey: o.owner_id }).requestPayment({
              method: "CARD",
              amount: { currency: "KRW", value: o.amount },
              orderId: o.id,
              orderName: o.name,
              successUrl: location.origin + "/billing/success",
              failUrl: location.origin + "/billing/fail",
            });
          } catch {
            setError("결제창을 열지 못했습니다. 잠시 후 다시 시도해 주세요.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "결제창 준비 중…" : "이용권 구매하기"}
      </Button>
      <p className="pricing-term">시연 결제이며 실제로 청구되지 않습니다.</p>
      {error && (
        <p role="alert" className="checkout-error">
          {error}
        </p>
      )}
    </>
  );
}
