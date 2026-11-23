import { z } from "zod";

export const freeFeatures = [
  "크리에이터 탐색·필터",
  "캠페인 브리프·기본 추천",
  "협업 제안·진행 관리",
  "규칙 기반 광고·제안 초안",
] as const;

export const testSkus = [
  "brand_pro",
  "agency",
  "creator_hot",
  "ai_credits",
  "search_run",
  "job_post",
  "job_application",
] as const;
export const testSkuSchema = z.enum(testSkus);
export const testProductSchema = z.object({
  sku: testSkuSchema,
  name: z.string().min(1),
  amount: z.number().int().positive(),
  role: z.enum(["brand", "creator"]),
  days: z.number().int().positive(),
  credits: z.number().int().nonnegative(),
});
export type TestProduct = z.infer<typeof testProductSchema>;

export const testProductDescriptions = {
  brand_pro: "브랜드 이용권 승인 흐름을 확인합니다.",
  agency:
    "에이전시 이용권 승인 흐름을 확인합니다. 팀 워크스페이스는 준비 중입니다.",
  creator_hot:
    "별도 광고 영역에 표시됩니다. 일반 추천 순위에는 영향을 주지 않습니다.",
  ai_credits: "TEST 크레딧 적립을 확인합니다. 고급 AI 분석은 준비 중입니다.",
  search_run: "후보가 있는 새 YouTube 조건 검색의 TEST 검색권입니다.",
  job_post: "YouTube 광고 공고를 게시할 때 사용하는 TEST 게시권입니다.",
  job_application:
    "소유권을 확인한 YouTube 채널로 지원할 때 사용하는 TEST 지원권입니다.",
} satisfies Record<TestProduct["sku"], string>;

export function testProductTerms(product: TestProduct) {
  const cost = `${product.amount.toLocaleString("ko-KR")}원`;
  return product.credits
    ? `${product.credits} 크레딧 / ${cost} · ${product.days}일`
    : `${cost} / ${product.days}일`;
}
export function assertTestClient(key: string | undefined) {
  if (!key || !/^test_ck_/.test(key))
    throw new Error(
      "Toss TEST 클라이언트 키(API 개별 연동 test_ck_) 연결이 필요합니다.",
    );
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
