import { z } from "zod";
import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  parseInput,
  requireContext,
  requireFeature,
} from "@/lib/api";
import { readProductConditionPage } from "@/lib/product-condition-workflow";

const response = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function brand() {
  const c = await requireContext();
  if (c.role !== "brand") fail("브랜드 계정에서 이용해주세요.", 403);
  return c;
}
export const POST = apiRoute("product-conditions.create", async (req) => {
  const c = await brand();
  requireFeature("llm");
  const p = await parseBody(
    req,
    z.strictObject({
      productId: z.uuid(),
      audience: z.string().trim().min(2).max(160),
      clientKey: z.uuid(),
    }),
    "상품과 타깃을 확인해주세요.",
  );
  const { data, error } = await c.db.rpc("product_conditions_create", {
    p_product: p.productId,
    p_audience: p.audience,
    p_key: p.clientKey,
  });
  if (error)
    failDatabase(
      error,
      "조건 추출을 접수하지 못했습니다. 수동 추천은 계속 사용할 수 있습니다.",
    );
  if (!z.uuid().safeParse(data).success)
    fail("조건 추출 응답을 확인하지 못했습니다.", 503);
  return response({ id: data }, 202);
});
export const GET = apiRoute("product-conditions.get", async (req) => {
  const c = await brand(),
    q = new URL(req.url).searchParams;
  if ([...q.keys()].some((key) => q.getAll(key).length !== 1))
    fail("조회 항목을 확인해주세요.", 422);
  const p = parseInput(
    z.union([
      z.strictObject({ id: z.uuid() }),
      z.strictObject({ productId: z.uuid() }),
    ]),
    Object.fromEntries(q),
    "조회 항목을 확인해주세요.",
  );
  return response(await readProductConditionPage(c.db, p));
});
export const PATCH = apiRoute("product-conditions.decide", async (req) => {
  const c = await brand(),
    p = await parseBody(
      req,
      z.strictObject({
        id: z.uuid(),
        clientKey: z.uuid(),
        expectedVersion: z.number().int().min(0).max(1),
        action: z.enum(["confirm", "dismiss"]),
        selected: z
          .array(z.number().int().min(0).max(7))
          .max(8)
          .refine((v) => new Set(v).size === v.length),
      }),
      "확인할 조건을 선택해주세요.",
    );
  const { error } = await c.db.rpc("product_conditions_decide", {
    p_id: p.id,
    p_key: p.clientKey,
    p_revision: p.expectedVersion,
    p_action: p.action,
    p_selected: p.selected,
  });
  if (error)
    failDatabase(
      error,
      "조건 상태가 바뀌었거나 확인할 수 없습니다. 다시 불러와 주세요.",
    );
  return response(await readProductConditionPage(c.db, { id: p.id }));
});
