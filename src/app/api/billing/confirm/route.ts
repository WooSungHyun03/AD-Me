import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
import { validateConfirmation } from "@/lib/billing";
import { z } from "zod";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      orderId: z.uuid(),
      paymentKey: z.string().min(1).max(300),
      amount: z.number().int().positive(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("결제 정보를 확인해주세요.");
  const { data: o } = await c.db
    .from("orders")
    .select("*")
    .eq("id", p.data.orderId)
    .eq("owner_id", c.user.id)
    .single();
  if (!o) return fail("주문을 확인할 수 없습니다.", 403);
  try {
    validateConfirmation(o, c.user.id, p.data.amount, p.data.paymentKey);
  } catch {
    return fail("주문 정보가 일치하지 않습니다.", 409);
  }
  const {
    data: { session },
  } = await c.db.auth.getSession();
  if (!session) return fail("다시 로그인해주세요.", 401);
  try {
    const res = await fetch(
      process.env.NEXT_PUBLIC_SUPABASE_URL + "/functions/v1/payment-confirm",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify(p.data),
        signal: AbortSignal.timeout(20000),
      },
    );
    const data = await res.json();
    if (!res.ok)
      return fail(
        data.error || "TEST 결제 승인이 준비되지 않았습니다.",
        res.status,
      );
    return NextResponse.json(data);
  } catch {
    return fail(
      "승인 서버에 연결할 수 없습니다. 결제 내역을 확인하고 다시 시도해주세요.",
      503,
    );
  }
}
