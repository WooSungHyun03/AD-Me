import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { context } from "@/lib/api";
import { ProductConditionWorkbench } from "@/components/product-condition-workbench";
export const dynamic = "force-dynamic";
export default async function ProductRecommendations({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await context();
  if (!actor)
    redirect(
      `/login?next=${encodeURIComponent(`/brand/products/${id}/recommendations`)}`,
    );
  if (actor.role !== "brand") notFound();
  const { data, error } = await actor.db
    .from("brand_products")
    .select("id,name")
    .eq("id", id)
    .eq("owner_id", actor.user.id)
    .maybeSingle();
  if (error || !data) notFound();
  return (
    <section className="wrap narrow">
      <Link href="/brand/products">← 내 광고 상품</Link>
      <h1 className="page-title">상품에서 추천 조건 찾기</h1>
      <p>
        내 상품에 명시된 분야·분위기·형식만 제안합니다. 실제 고객 특성이나
        성과를 추론하지 않습니다.
      </p>
      <ProductConditionWorkbench productId={id} productName={data.name} />
    </section>
  );
}
