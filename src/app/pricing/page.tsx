import { products } from "@/lib/billing";
import { Checkout } from "@/components/checkout";
export default function Pricing() {
  return (
    <section className="wrap">
      <span className="eyebrow">A plan for your next chapter</span>
      <h1 className="page-title">좋은 협업에 집중할 수 있도록.</h1>
      <p>브랜드의 규모와 크리에이터의 다음 단계에 맞는 선택.</p>
      <div className="notice">
        Toss Payments TEST 결제 전용 · 실제 청구 없음 · 자동 갱신 없는 30일
        이용권입니다. TEST 키가 연결되지 않으면 결제가 진행되지 않습니다. 현재
        핵심 기능은 무료로 이용할 수 있으며 유료 이용권으로 추가 제한을 해제하지
        않습니다.
      </div>
      <div className="plans">
        {products.map((p) => (
          <article
            key={p.sku}
            className={`plan ${p.sku === "brand_pro" ? "featured" : ""}`}
          >
            <span
              className="eyebrow"
              style={p.sku === "brand_pro" ? { color: "#d7ff45" } : {}}
            >
              {p.role === "brand" ? "FOR BRANDS" : "FOR CREATORS"}
            </span>
            <h3 style={{ marginTop: 18 }}>{p.name}</h3>
            <div className="price">
              {p.amount.toLocaleString()}
              <span style={{ fontSize: 15 }}>원</span>
            </div>
            <small>{p.amount ? "30일 / TEST 결제" : "계속 무료"}</small>
            <ul>
              {p.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Checkout sku={p.sku} />
          </article>
        ))}
      </div>
      <div className="section-heading" style={{ marginTop: 45 }}>
        <div>
          <h3>AI 분석 크레딧</h3>
          <p>
            20 크레딧 / 4,900원 · TEST 구매 · 고급 분석 사용은 준비 중입니다.
          </p>
        </div>
        <Checkout sku="ai_credits" />
      </div>
    </section>
  );
}
