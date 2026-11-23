import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { ProductForm } from "@/app/jobs/forms";

export default async function BrandProducts() {
  const c = await context();
  if (!c) redirect("/login");
  return (
    <section className="wrap">
      <h1 className="page-title">광고 상품</h1>
      {c.role !== "brand" ? (
        <p>브랜드 계정으로 이용할 수 있습니다.</p>
      ) : (
        <ProductList db={c.db} />
      )}
    </section>
  );
}

async function ProductList({
  db,
}: {
  db: NonNullable<Awaited<ReturnType<typeof context>>>["db"];
}) {
  const { data, error } = await db
    .from("brand_products")
    .select("id,name,description")
    .order("created_at", { ascending: false })
    .limit(60);
  return (
    <>
      <p>
        공고 초안에 연결할 상품을 등록하세요. 이 목록은 내 브랜드 계정에서만 볼
        수 있습니다.
      </p>
      <ProductForm />
      <h2>등록 상품</h2>
      {error ? (
        <p role="alert">상품을 불러오지 못했습니다.</p>
      ) : data.length ? (
        data.map((row) => (
          <article className="ops-row" key={row.id}>
            <strong>{row.name}</strong>
            <p>{row.description}</p>
          </article>
        ))
      ) : (
        <p className="empty">등록한 상품이 없습니다.</p>
      )}
      <Link className="button outline" href="/jobs/new">
        공고 초안 만들기
      </Link>
    </>
  );
}
