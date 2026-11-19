import { NextResponse } from "next/server";
import { context, fail, safeOrigin } from "@/lib/api";
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.sku !== "string") return fail("상품을 선택해주세요.");
  const { data, error } = await c.db.rpc("create_test_order", {
    p_sku: body.sku,
  });
  if (error)
    return fail("역할에 맞는 상품을 선택하거나 잠시 후 다시 시도해주세요.");
  const { data: item } = await c.db
    .from("products")
    .select("name")
    .eq("sku", data.sku)
    .single();
  return NextResponse.json({ ...data, name: item?.name });
}
