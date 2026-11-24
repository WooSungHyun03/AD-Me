import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, failDatabase } from "./api";
import { redact } from "./ai";
import {
  productConditionPageSchema,
  productConditionSource,
} from "./product-conditions";

export function modelProductSourceVersion(raw: unknown) {
  const input = productConditionSource.parse(raw);
  // Python's sorted, UTF-8 JSON contract uses these exact keys and compact separators.
  return createHash("sha256")
    .update(
      JSON.stringify({
        audience: redact(input.audience),
        description: redact(input.description),
        name: redact(input.name),
      }),
    )
    .digest("hex");
}
export async function readProductConditionPage(
  db: SupabaseClient,
  query: { id: string } | { productId: string },
) {
  const byId = "id" in query;
  const { data, error } = await db.rpc(
    byId ? "product_conditions_get" : "product_conditions_latest",
    byId ? { p_id: query.id } : { p_product: query.productId },
  );
  if (error) failDatabase(error, "상품 추천 조건을 불러오지 못했습니다.");
  if (data === null && !byId) return null;
  const parsed = productConditionPageSchema.safeParse(data);
  if (
    !parsed.success ||
    (byId
      ? parsed.data.id !== query.id
      : parsed.data.productId !== query.productId) ||
    (parsed.data.output &&
      parsed.data.output.modelSourceVersion !==
        modelProductSourceVersion(parsed.data.source))
  )
    fail("상품 추천 조건 응답을 확인하지 못했습니다.", 503);
  return parsed.data;
}
export async function confirmedProductConditionContext(
  db: SupabaseClient,
  reference: { id: string; revision: number; sourceVersion: string },
  brief: {
    product: string;
    audience: string;
    category: string;
    preference: string;
    format: string;
  },
) {
  const page = await readProductConditionPage(db, { id: reference.id });
  if (
    !page ||
    page.status !== "done" ||
    page.decision !== "confirmed" ||
    page.revision !== reference.revision ||
    page.sourceVersion !== reference.sourceVersion ||
    page.source.name !== brief.product ||
    page.source.audience !== brief.audience
  )
    throw Error("PRODUCT_CONFIRMATION_CHANGED");
  for (const row of page.selected) {
    if (
      (row.kind === "category" && row.value !== brief.category) ||
      (row.kind === "format" && row.value !== brief.format) ||
      (row.kind === "vibe" &&
        !brief.preference.split(/[,\s]+/).includes(row.value))
    )
      throw Error("PRODUCT_CONFIRMATION_CHANGED");
  }
  return {
    id: page.id,
    sourceVersion: page.sourceVersion,
    promptVersion: page.output!.promptVersion,
  };
}
