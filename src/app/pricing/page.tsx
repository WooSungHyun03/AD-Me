import Link from "next/link";
import { getConfig } from "@/lib/config";
import {
  freeFeatures,
  testProductDescriptions,
  testProductTerms,
} from "@/lib/billing";
import { getTestProducts } from "@/lib/test-products";
import { Checkout } from "@/components/checkout";

export const dynamic = "force-dynamic";

export default async function Pricing() {
  const test = await getTestProducts();
  const isTestMode = getConfig().serviceMode === "test_demo";
  return (
    <section className="wrap">
      <h1 className="page-title">요금제</h1>
      <p>탐색, 캠페인, 협업의 기본 기능을 무료로 이용할 수 있습니다.</p>
      <div className="plans">
        <article className="plan">
          <h2>무료 베타</h2>
          <div className="price">0원</div>
          <ul>
            {freeFeatures.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <Link className="button outline" href="/signup">
            무료로 시작하기
          </Link>
        </article>
      </div>
      {isTestMode && (
        <>
          <h2 style={{ marginTop: 40 }}>TEST 상품</h2>
          {test?.products.length ? (
            <>
              <p className="notice">
                Toss Payments TEST 전용입니다. 실제 청구와 자동 갱신은 없습니다.
              </p>
              <div className="plans">
                {test.products.map((product) => (
                  <article className="plan" key={product.sku}>
                    <h3>
                      {product.sku === "ai_credits"
                        ? "AI 분석 크레딧"
                        : product.name}
                    </h3>
                    <p>{testProductTerms(product)}</p>
                    <p>{testProductDescriptions[product.sku]}</p>
                    <Checkout
                      sku={product.sku}
                      clientKey={test.key}
                      displayedAmount={product.amount}
                    />
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p role="status" className="notice">
              TEST 결제 연결을 준비 중입니다.
            </p>
          )}
        </>
      )}
    </section>
  );
}
