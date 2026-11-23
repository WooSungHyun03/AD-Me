import Link from "next/link";
import { redirect } from "next/navigation";
import { context } from "@/lib/api";
import { TestCheckout as Checkout } from "@/components/test-checkout";
import { SearchForm } from "@/app/jobs/forms";
export default async function Explore() {
  const c = await context();
  if (!c) redirect("/login");
  return (
    <section className="wrap">
      <h1 className="page-title">YouTube 후보 조건 검색</h1>
      {c.role !== "brand" ? (
        <p>브랜드 계정으로 이용할 수 있습니다.</p>
      ) : (
        <>
          <p>
            공개 동의와 소유권 확인을 마친 YouTube 크리에이터를 검색합니다.
            결과가 없거나 같은 검색을 다시 열면 이용권이 차감되지 않습니다.
          </p>
          <p>평균 조회수는 YouTube 파생 지표 이용 승인 이후 제공됩니다.</p>
          <Checkout sku="search_run" />
          <SearchForm />
        </>
      )}
      <Link href="/creators/youtube">확인된 YouTube 채널 목록</Link>
    </section>
  );
}
