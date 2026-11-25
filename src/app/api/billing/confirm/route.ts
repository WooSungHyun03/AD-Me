import { NextResponse } from "next/server";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
  requireTestBilling,
} from "@/lib/api";
import { validateConfirmation } from "@/lib/billing";
import { getConfig } from "@/lib/config";
import {
  confirmationInput,
  confirmationResult,
} from "@/lib/billing-confirmation";

export const POST = apiRoute("billing.confirm.post", async (req) => {
  requireTestBilling();
  const config = getConfig().supabase;
  if (!config) fail("승인 서버 연결을 준비 중입니다.", 503);
  const c = await requireContext();
  const p = await parseBody(
    req,
    confirmationInput,
    "결제 정보를 확인해주세요.",
  );
  const { data: o, error } = await c.db
    .from("orders")
    .select("*")
    .eq("id", p.orderId)
    .eq("owner_id", c.user.id)
    .maybeSingle();
  if (error) failDatabase(error, "주문을 불러오지 못했습니다.");
  if (!o) return fail("주문을 확인할 수 없습니다.", 403);
  try {
    validateConfirmation(o, c.user.id, p.amount, p.paymentKey);
  } catch {
    return fail("주문 정보가 일치하지 않습니다.", 409);
  }
  const {
    data: { session },
  } = await c.db.auth.getSession();
  if (!session) return fail("다시 로그인해주세요.", 401);
  const unavailable =
    "승인 서버 응답을 확인하지 못했습니다. 같은 주문으로 다시 확인해주세요.";
  const res = await fetch(
    new URL("/functions/v1/payment-confirm", config.url),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: config.key,
      },
      body: JSON.stringify(p),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    },
  ).catch(() => fail(unavailable, 503));
  if (!res.ok) {
    // D067: keep the status mapping, but surface the one safe provider-side code the user can act on.
    const code = await res
      .json()
      .then((b: { error?: unknown }) => b?.error)
      .catch(() => null);
    // The function reports a missing TEST secret either as a code or as its fixed Korean text;
    // either way we answer with our own fixed wording (no provider text is forwarded).
    if (
      res.status === 503 &&
      (code === "secret_missing" ||
        (typeof code === "string" && code.includes("시크릿 키")))
    )
      return fail(
        "Toss TEST 시크릿 키가 연결되지 않아 승인할 수 없습니다. 이용권은 부여되지 않았습니다.",
        503,
      );
    switch (res.status) {
      case 400:
        return fail(
          "Toss TEST 승인이 완료되지 않았습니다. 이용권은 부여되지 않았습니다. 주문 상태를 확인해주세요.",
          400,
        );
      case 401:
        return fail("다시 로그인해주세요.", 401);
      case 403:
        return fail("주문을 확인할 수 없습니다.", 403);
      case 409:
        return fail("주문 정보가 일치하지 않습니다.", 409);
      case 429:
        return fail("잠시 후 같은 주문으로 다시 확인해주세요.", 429);
      default:
        return fail(unavailable, 503);
    }
  }
  const result = confirmationResult.safeParse(
    await res.json().catch(() => null),
  );
  if (!result.success) fail(unavailable, 503);
  return NextResponse.json(result.data);
});
