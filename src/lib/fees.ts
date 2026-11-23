// D072: assumption-only fee simulator. Nothing is charged, stored, sent or aggregated — inputs never leave the browser.
export const FEE_LIMITS = { maxPrice: 100_000_000, maxRate: 30 } as const;
export function estimateFee(price: number, ratePct: number) {
  if (
    !Number.isFinite(price) ||
    !Number.isInteger(price) ||
    price < 0 ||
    price > FEE_LIMITS.maxPrice
  )
    return {
      error: `협업 금액은 0~${FEE_LIMITS.maxPrice.toLocaleString()}원 사이 정수로 입력하세요.`,
    } as const;
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > FEE_LIMITS.maxRate)
    return {
      error: `가정 수수료율은 0~${FEE_LIMITS.maxRate}% 사이로 입력하세요.`,
    } as const;
  const fee = Math.round((price * ratePct) / 100);
  return { fee, net: price - fee } as const;
}
