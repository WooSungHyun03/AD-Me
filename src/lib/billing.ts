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
// D066: checkout uses SDK v2 payment() = "API 개별 연동", whose keys are the test_ck_/test_sk_ set. Widget keys
// (test_gck_/test_gsk_) belong to widgets() and fail with INVALID_API_KEY, so they are refused up front.
export function assertTestClient(key: string | undefined) {
  if (!key || !/^test_ck_/.test(key))
    throw new Error("Toss TEST 클라이언트 키 연결이 필요합니다.");
  return key;
}
export function assertTestSecret(key: string | undefined) {
  if (!key || !/^test_sk_/.test(key))
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
// D068: Edge Function / DB cancel codes → user messages. Unknown codes fall back to a generic message.
export const cancelErrors: Record<string, string> = {
  invalid_request: "취소 사유(2~200자)를 확인해주세요.",
  secret_missing: "Toss TEST 시크릿 키가 연결되지 않아 취소할 수 없습니다.",
  not_found: "취소할 수 있는 주문을 찾을 수 없습니다.",
  already_cancelled: "이미 취소된 주문입니다.",
  not_cancellable: "결제 완료된 TEST 주문만 취소할 수 있습니다.",
  cancel_in_progress: "이미 취소를 처리하는 중입니다.",
  credits_in_use: "크레딧 사용이 진행 중입니다. 잠시 후 다시 시도해주세요.",
  credits_used: "크레딧을 사용한 이용권은 취소할 수 없습니다.",
  idempotency_conflict: "요청이 중복되었습니다. 새로고침 후 다시 시도해주세요.",
  provider_refused: "Toss TEST 취소가 거절되었습니다. 이용권은 유지됩니다.",
  provider_retry:
    "취소 결과를 확인하지 못했습니다. 같은 요청으로 다시 시도해주세요.",
  provider_mismatch: "취소 결과가 주문과 일치하지 않습니다.",
  function_unavailable:
    "TEST 결제 취소 서버(Edge Function)가 연결되지 않았습니다. 주문은 그대로 유지됩니다.",
};
export const cancelMessage = (code: unknown) =>
  (typeof code === "string" && cancelErrors[code]) ||
  "TEST 취소를 처리하지 못했습니다.";
