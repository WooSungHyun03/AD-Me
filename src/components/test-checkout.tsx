import { Checkout } from "./checkout";
import { getTestProducts } from "@/lib/test-products";
import type { TestProduct } from "@/lib/billing";
export async function TestCheckout({ sku }: { sku: TestProduct["sku"] }) {
  const catalog = await getTestProducts(),
    product = catalog?.products.find((p) => p.sku === sku);
  if (!catalog || !product)
    return <p role="status">현재 이용권을 구매할 수 없습니다.</p>;
  return (
    <Checkout
      sku={product.sku}
      clientKey={catalog.key}
      displayedAmount={product.amount}
    />
  );
}
