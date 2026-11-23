import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Checkout } from "@/components/checkout";
import { FeeSimulator } from "@/components/fee-simulator";
import {
  testProductDescriptions,
  testProductTerms,
  type TestProduct,
} from "@/lib/billing";

const featured = [
  {
    sku: "search_run",
    name: "AI 검색권",
    amount: 3000,
    role: "brand",
    term: "검색 1회 · 30일",
    detail: "후보가 있는 새 조건 검색에 사용합니다.",
    href: "/explore",
    action: "조건 검색 보기",
  },
  {
    sku: "job_post",
    name: "광고 공고 게시권",
    amount: 5000,
    role: "brand",
    term: "공고 게시 1회 · 30일",
    detail: "YouTube 협업 모집 공고를 게시합니다. 초안은 무료입니다.",
    href: "/jobs/new",
    action: "공고 초안 작성",
  },
  {
    sku: "job_application",
    name: "광고 공고 지원권",
    amount: 1000,
    role: "creator",
    term: "공고 지원 1회 · 30일",
    detail: "소유권을 확인한 YouTube 채널로 공고에 지원합니다.",
    href: "/jobs",
    action: "모집 공고 보기",
  },
  {
    sku: "creator_hot",
    name: "HOT 상단 노출 회원권",
    amount: 9900,
    role: "creator",
    term: "스폰서 영역 노출 · 30일",
    detail:
      "별도 스폰서 영역에 표시됩니다. 일반 추천 순위에는 영향이 없습니다.",
    href: "/dashboard",
    action: "내 이용권 확인",
  },
] as const;

type TestCatalog = { key: string; products: TestProduct[] } | null;

export function PricingPlans({ test }: { test: TestCatalog }) {
  const products = new Map(
    test?.products.map((product) => [product.sku, product]),
  );
  const extra =
    test?.products.filter(
      (product) => !featured.some((item) => item.sku === product.sku),
    ) ?? [];
  return (
    <>
      <section className="pricing-hero">
        <div className="wrap pricing-intro">
          <div>
            <h1>협업에 필요한 만큼.</h1>
            <p>크리에이터 탐색과 캠페인 초안은 무료로 시작하세요.</p>
          </div>
          <div className="pricing-free">
            <div>
              <h2>무료 베타</h2>
              <strong>0원</strong>
            </div>
            <ul>
              <li>
                <Check aria-hidden="true" size={16} /> YouTube 채널 탐색
              </li>
              <li>
                <Check aria-hidden="true" size={16} /> 캠페인 초안과 기본 추천
              </li>
              <li>
                <Check aria-hidden="true" size={16} /> 협업 제안과 진행 관리
              </li>
            </ul>
            <Link className="button primary" href="/signup">
              무료로 시작하기 <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section
        className="wrap pricing-catalog"
        aria-labelledby="pricing-catalog-title"
      >
        <h2 id="pricing-catalog-title">검색·게시·지원 이용권</h2>
        <p className="pricing-mode">
          {test?.products.length
            ? "이곳에서는 결제를 체험할 수 있습니다. 실제 청구와 자동 갱신은 없습니다."
            : "무료 베타에서는 이용권을 구매할 수 없습니다. 표시된 금액은 결제 체험 기준입니다."}
        </p>
        {(["brand", "creator"] as const).map((role) => (
          <section className="pricing-group" key={role}>
            <h3>{role === "brand" ? "브랜드" : "크리에이터"}</h3>
            <div className="pricing-grid">
              {featured
                .filter((item) => item.role === role)
                .map((item) => {
                  const product = products.get(item.sku);
                  return (
                    <article
                      key={item.sku}
                      id={item.sku}
                      className="pricing-product"
                      data-testid={`pricing-${item.sku}`}
                    >
                      <div>
                        <h4>{item.name}</h4>
                        <p className="pricing-amount">
                          {(product?.amount ?? item.amount).toLocaleString(
                            "ko-KR",
                          )}
                          <small>원</small>
                        </p>
                        <p className="pricing-term">
                          {product ? testProductTerms(product) : item.term}
                        </p>
                      </div>
                      <div className="pricing-product-action">
                        <p>{item.detail}</p>
                        {test && product ? (
                          <Checkout
                            sku={product.sku}
                            clientKey={test.key}
                            displayedAmount={product.amount}
                          />
                        ) : (
                          <Link
                            className={`button ${item.sku === "job_post" ? "primary" : "outline"}`}
                            href={item.href}
                          >
                            {item.action}{" "}
                            <ArrowUpRight aria-hidden="true" size={16} />
                          </Link>
                        )}
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>
        ))}
        {test && extra.length > 0 && (
          <section className="pricing-group">
            <h3>추가 이용권</h3>
            <div className="pricing-grid">
              {extra.map((product) => (
                <article className="pricing-product" key={product.sku}>
                  <div>
                    <h4>{product.name}</h4>
                    <p>{testProductTerms(product)}</p>
                  </div>
                  <div className="pricing-product-action">
                    <p>{testProductDescriptions[product.sku]}</p>
                    <Checkout
                      sku={product.sku}
                      clientKey={test.key}
                      displayedAmount={product.amount}
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        <FeeSimulator />
      </section>
    </>
  );
}
