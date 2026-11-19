export const products = [
  {
    sku: "brand_free",
    name: "Brand Free",
    amount: 0,
    role: "brand",
    features: [
      "크리에이터 탐색·필터",
      "캠페인 브리프·기본 추천",
      "협업 제안·진행 관리",
    ],
  },
  {
    sku: "brand_pro",
    name: "Brand Pro",
    amount: 49000,
    role: "brand",
    features: [
      "브랜드 30일 이용권",
      "후보 비교·추천 근거",
      "AI 스튜디오 기본 도구",
    ],
  },
  {
    sku: "agency",
    name: "Agency",
    amount: 149000,
    role: "brand",
    features: [
      "에이전시 30일 이용권",
      "캠페인·크리에이터 관리",
      "팀 워크스페이스는 준비 중",
    ],
  },
  {
    sku: "creator_hot",
    name: "Creator HOT",
    amount: 9900,
    role: "creator",
    features: [
      "30일 프로모션 이용권",
      "별도 유료 HOT 노출",
      "일반 추천 점수에 영향 없음",
    ],
  },
];
export function assertTestClient(key: string | undefined) {
  if (!key || !/^test_(ck|gck)_/.test(key))
    throw new Error("Toss TEST 클라이언트 키 연결이 필요합니다.");
  return key;
}
export function assertTestSecret(key: string | undefined) {
  if (!key || !/^test_(sk|gsk)_/.test(key))
    throw new Error("Toss TEST 시크릿 키 연결이 필요합니다.");
  return key;
}
export function activeEntitlement(
  e: { starts_at: string; expires_at: string },
  now = new Date(),
) {
  return new Date(e.starts_at) <= now && new Date(e.expires_at) > now;
}
export function validateConfirmation(
  order: {
    owner_id: string;
    amount: number;
    status: string;
    payment_key?: string | null;
  },
  userId: string,
  amount: number,
  paymentKey: string,
) {
  if (order.owner_id !== userId) throw new Error("주문 소유자가 다릅니다.");
  if (order.amount !== amount || !Number.isSafeInteger(amount) || amount <= 0)
    throw new Error("주문 금액이 다릅니다.");
  if (!paymentKey || paymentKey.length > 300)
    throw new Error("결제 정보가 올바르지 않습니다.");
  if (order.status === "paid" && order.payment_key !== paymentKey)
    throw new Error("이미 처리된 다른 결제입니다.");
  if (!["pending", "paid"].includes(order.status))
    throw new Error("승인할 수 없는 주문입니다.");
}
