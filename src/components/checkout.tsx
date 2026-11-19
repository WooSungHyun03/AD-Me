"use client";
import { useState } from "react";
import Link from "next/link";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { assertTestClient } from "@/lib/billing";
import { Button } from "./ui/button";
export function Checkout({ sku }: { sku: string }) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  if (sku === "brand_free")
    return (
      <Link className="button outline" href="/signup">
        무료로 시작하기
      </Link>
    );
  return (
    <>
      <Button
        variant="outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const key = assertTestClient(
              process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY,
            );
            const res = await fetch("/api/billing/orders", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sku }),
            });
            const o = await res.json();
            if (!res.ok) throw new Error(o.error?.message || "주문 생성 실패");
            const toss = await loadTossPayments(key);
            await toss
              .payment({ customerKey: o.owner_id })
              .requestPayment({
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
