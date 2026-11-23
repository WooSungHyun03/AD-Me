import { z } from "zod";
export const confirmationInput = z.strictObject({
  orderId: z.uuid(),
  paymentKey: z.string().min(1).max(300),
  amount: z.number().int().min(1).max(100000000),
});
export const confirmationResult = z.union([
  z.strictObject({ ok: z.literal(true), duplicate: z.literal(true) }),
  z.strictObject({ ok: z.literal(true), entitlementId: z.uuid() }),
]);
export async function confirmTestPayment(
  input: unknown,
  request: typeof fetch = fetch,
): Promise<{ state: "confirmed" | "retry" | "rejected"; message: string }> {
  const parsed = confirmationInput.safeParse(input);
  if (!parsed.success)
    return {
      state: "rejected",
      message: "결제 인증 정보가 올바르지 않습니다. 원래 주문을 확인해주세요.",
    };
  try {
    const res = await request("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(25000),
      redirect: "error",
    });
    const body: unknown = await res.json().catch(() => null);
    if (res.ok && confirmationResult.safeParse(body).success)
      return {
        state: "confirmed",
        message: "체험 결제가 확인되었습니다. 실제로 청구되지 않았습니다.",
      };
    if (res.ok || res.status === 429 || res.status >= 500)
      return {
        state: "retry",
        message:
          "승인 상태가 아직 확인되지 않았습니다. 새 주문을 만들지 말고 같은 주문으로 다시 확인해주세요.",
      };
    return {
      state: "rejected",
      message:
        "결제 승인 정보를 확인하지 못했습니다. 원래 주문을 확인해 주세요.",
    };
  } catch {
    return {
      state: "retry",
      message:
        "연결이 중단되었습니다. 새 주문을 만들지 말고 같은 주문으로 다시 확인해주세요.",
    };
  }
}
