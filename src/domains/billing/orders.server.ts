import { NextResponse } from "next/server";
import { z } from "zod";
import { testSkuSchema } from "@/lib/billing";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
  requireTestBilling,
} from "@/lib/api";
export const createOrder = apiRoute("billing.orders.post", async (req) => {
  requireTestBilling();
  const c = await requireContext();
  const body = await parseBody(
    req,
    z.object({
      sku: testSkuSchema,
      expectedAmount: z.number().int().positive().optional(),
    }),
    "상품을 선택해주세요.",
  );
  const { data: item, error: itemError } = await c.db
    .from("products")
    .select("name,role,amount")
    .eq("sku", body.sku)
    .maybeSingle();
  if (itemError) failDatabase(itemError, "상품을 불러오지 못했습니다.");
  if (!item) fail("상품을 선택해주세요.", 422);
  if (item.role !== c.role) fail("역할에 맞는 상품을 선택해주세요.", 403);
  if (body.expectedAmount !== undefined && item.amount !== body.expectedAmount)
    fail("상품 금액이 변경되었습니다. 요금제를 새로고침해주세요.", 409);
  const { data, error } = await c.db.rpc("create_test_order", {
    p_sku: body.sku,
  });
  if (error?.code === "P0001" && error.message === "order rate limit")
    fail("주문 한도에 도달했습니다. 잠시 후 다시 시도해주세요.", 429);
  if (error?.code === "P0001" && error.message === "invalid product or role")
    fail("역할에 맞는 상품을 선택해주세요.", 403);
  if (error) failDatabase(error, "주문을 만들지 못했습니다.");
  return NextResponse.json({ ...data, name: item.name });
});
