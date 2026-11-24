import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { JobDraftForm } from "../forms";

export default async function NewJob() {
  const c = await context();
  if (!c) redirect("/login");
  if (c.role !== "brand")
    return (
      <section className="wrap">
        <h1>브랜드 계정으로 캠페인을 작성할 수 있습니다.</h1>
      </section>
    );
  const { data, error } = await c.db
    .from("brand_products")
    .select("id,name")
    .order("created_at", { ascending: false })
    .limit(60);
  return (
    <section className="figma-width figma-campaign-detail">
      <Link href="/jobs">캠페인 목록</Link>
      <p className="figma-eyebrow">CREATE A CAMPAIGN</p>
      <h1 className="page-title">좋은 협업의 시작, 명확한 제안.</h1>
      <p>초안 저장은 무료입니다. 공개할 때 게시권 1장이 필요합니다.</p>
      {error ? (
        <p role="alert">상품 목록을 불러오지 못했습니다.</p>
      ) : data.length ? (
        <JobDraftForm products={data} />
      ) : (
        <p>
          캠페인에 연결할{" "}
          <Link href="/brand/products">광고 상품을 먼저 등록</Link>해주세요.
        </p>
      )}
    </section>
  );
}
