import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { isDemoMode } from "@/lib/mode";
import { cancelMessage } from "@/lib/billing";
import { reportError } from "@/lib/observability";
// D068: forwards to the Edge Function, which alone holds the Toss TEST secret. No paymentKey is accepted here.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  if (!isDemoMode())
    return fail("무료 베타에서는 결제·유료 이용권을 제공하지 않습니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      orderId: z.uuid(),
      idempotencyKey: z.uuid(),
      reason: z.string().trim().min(2).max(200),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail(cancelMessage("invalid_request"));
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
        body: JSON.stringify({ action: "cancel", ...p.data }),
        signal: AbortSignal.timeout(25000),
      },
    );
    const data = await res.json().catch(() => ({}));
    // A non-JSON error means the Edge Function itself is not deployed/served.
    if (!res.ok)
      return data.error
        ? fail(cancelMessage(data.error), res.status)
        : fail(cancelMessage("function_unavailable"), 503);
    return NextResponse.json({ ok: data.ok === true, status: data.status });
  } catch (e) {
    await reportError(e, { route: "/api/billing/cancel" });
    return fail(cancelMessage("provider_retry"), 503);
  }
}
