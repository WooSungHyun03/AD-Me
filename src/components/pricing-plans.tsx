import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { Checkout } from "@/components/checkout";
import { FeeSimulator } from "@/components/fee-simulator";
import {
  testProductDescriptions,
  testProductTerms,
  type TestProduct,
} from "@/lib/billing";

type TestCatalog = { key: string; products: TestProduct[] } | null;

export function PricingPlans({ test }: { test: TestCatalog }) {
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
      {test && test.products.length > 0 ? (
        <section
          className="wrap pricing-catalog"
          aria-labelledby="pricing-catalog-title"
        >
          <h2 id="pricing-catalog-title">검색·게시·지원 이용권</h2>
          <p className="pricing-mode">
            격리된 결제 체험 화면입니다. 실제 청구와 자동 갱신은 없습니다.
          </p>
          <div className="pricing-grid">
            {test.products.map((product) => (
              <article
                key={product.sku}
                id={product.sku}
                className="pricing-product"
                data-testid={`pricing-${product.sku}`}
              >
                <div>
                  <h3>{product.name}</h3>
                  <p className="pricing-amount">
                    {product.amount.toLocaleString("ko-KR")}
                    <small>원</small>
                  </p>
                  <p className="pricing-term">{testProductTerms(product)}</p>
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
          <FeeSimulator />
        </section>
      ) : (
        <section
          className="wrap pricing-catalog"
          aria-labelledby="pricing-available"
        >
          <h2 id="pricing-available">지금 이용할 수 있는 기능</h2>
          <div className="figma-actions">
            <Link className="button outline" href="/creators">
              크리에이터 탐색
            </Link>
            <Link className="button outline" href="/jobs/new">
              캠페인 초안 작성
            </Link>
          </div>
        </section>
      )}
    </>
  );
}
