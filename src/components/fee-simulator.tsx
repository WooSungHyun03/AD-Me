"use client";
import { useState } from "react";
import { estimateFee, FEE_LIMITS } from "@/lib/fees";
// D072: optional what-if calculator. No API call, no storage, no analytics event.
export function FeeSimulator() {
  const [price, setPrice] = useState("1000000");
  const [rate, setRate] = useState("10");
  const r = estimateFee(Number(price), Number(rate));
  return (
    <section
      className="panel"
      aria-labelledby="fee-sim"
      data-testid="fee-simulator"
      style={{ marginTop: 45 }}
    >
      <span className="badge">가정 계산 · 실제 수납·정산 없음</span>
      <h3 id="fee-sim" style={{ marginTop: 16 }}>
        수수료 가정 계산기
      </h3>
      <p style={{ fontSize: 13 }}>
        AD Me는 현재 협업 대금을 받거나 정산하지 않으며 수수료를 부과하지
        않습니다. 아래 결과는 입력한 가정값의 단순 계산이며, 저장·집계되지 않고
        실제 청구·미수금·매출이 아닙니다.
      </p>
      <div className="form-grid">
        <label className="field">
          협업 금액 (원)
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={FEE_LIMITS.maxPrice}
            step={1000}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label className="field">
          가정 수수료율 (%)
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={FEE_LIMITS.maxRate}
            step={0.5}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
      </div>
      <p role="status" aria-live="polite">
        {"error" in r ? (
          <span className="error">{r.error}</span>
        ) : (
          <>
            가정 수수료 <strong>{r.fee.toLocaleString()}원</strong> · 크리에이터
            수령 가정액 <strong>{r.net.toLocaleString()}원</strong>
          </>
        )}
      </p>
    </section>
  );
}
