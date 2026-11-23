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
    [pending, setPending] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  return (
    <div>
      <p>
        결제 결과를 확인하면 체험 이용권이 활성화됩니다. 실제 청구는 없습니다.
      </p>
      <Button
        disabled={pending || confirmed}
        onClick={async () => {
          setPending(true);
          try {
            const result = await confirmTestPayment({
              orderId,
              paymentKey,
              amount,
            });
            setConfirmed(result.state === "confirmed");
            setState(result.message);
          } catch {
            setState("네트워크 오류입니다. 다시 시도해주세요.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "확인 중…" : "결제 결과 확인"}
      </Button>
      <p role="status" style={{ marginTop: 20 }}>
        {state}
      </p>
    </div>
  );
}
