"use client";
import { useState } from "react";
import { Button } from "./ui/button";
import { confirmTestPayment } from "@/lib/billing-confirmation";
export function PaymentConfirm({
  orderId,
  paymentKey,
  amount,
}: {
  orderId: string;
  paymentKey: string;
  amount: number;
}) {
  const [state, setState] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <div>
      <p>
        서버에서 주문 소유권·금액과 Toss 승인 결과를 검증해야 이용권이
        활성화됩니다.
      </p>
      <Button
        disabled={pending || state === "TEST 결제가 승인되었습니다."}
        onClick={async () => {
          setPending(true);
          try {
            const result = await confirmTestPayment({
              orderId,
              paymentKey,
              amount,
            });
            setState(result.message);
          } catch {
            setState("네트워크 오류입니다. 다시 시도해주세요.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "확인 중…" : "TEST 결제 승인 확인"}
      </Button>
      <p role="status" style={{ marginTop: 20 }}>
        {state}
      </p>
    </div>
  );
}
