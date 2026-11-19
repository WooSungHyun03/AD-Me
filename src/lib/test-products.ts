import "server-only";
import { z } from "zod";
import { testProductSchema, testSkus } from "./billing";
import { getConfig } from "./config";
import { supabase } from "./supabase";

export async function getTestProducts() {
  const key = getConfig().testBillingClientKey;
  if (!key) return null;
  const db = await supabase();
  const { data, error } = await db
    .from("products")
    .select("sku,name,amount,role,days,credits")
    .in("sku", [...testSkus]);
  const products = z.array(testProductSchema).safeParse(data);
  if (error || !products.success) return null;
  const items = new Map(products.data.map((product) => [product.sku, product]));
  return {
    key,
    products: testSkus.flatMap((sku) => {
      const product = items.get(sku);
      return product ? [product] : [];
    }),
  };
}
