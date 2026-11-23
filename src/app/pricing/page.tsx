import Link from "next/link";

const products = [
  {
    sku: "search_run",
    name: "AI 검색권",
    amount: 3000,
    role: "brand",
    features: ["후보가 있는 새 조건 검색 1회", "동일 조건 재검색은 무료"],
  },
  {
    sku: "job_post",
    name: "광고 공고 게시권",
    amount: 5000,
    role: "brand",
    features: ["YouTube 광고 공고 게시 1회", "무료 초안 작성"],
  },
  {
    sku: "job_application",
    name: "광고 지원권",
    amount: 1000,
    role: "creator",
    features: ["YouTube 광고 공고 지원 1회", "채널 소유권 인증 필요"],
  },
  {
    sku: "creator_hot",
    name: "Creator HOT",
    amount: 9900,
    role: "creator",
    features: ["30일 스폰서 노출", "일반 점수에 영향 없음"],
  },
];
import { Checkout } from "@/components/checkout";
import { FeeSimulator } from "@/components/fee-simulator";
export const metadata = {
  title: "요금제",
  alternates: { canonical: "/pricing" },
};
export default function Pricing() {
  const plans = products;
  return (
    <section className="wrap">
      <span className="eyebrow">A plan for your next chapter</span>
      <h1 className="page-title">좋은 협업에 집중할 수 있도록.</h1>
      <p>브랜드의 규모와 크리에이터의 다음 단계에 맞는 선택.</p>
      <div className="notice">
        Toss Payments TEST 결제 전용 · 실제 청구 없음 · 자동 갱신 없는 30일
        이용권입니다. TEST 키가 연결되지 않으면 결제가 진행되지 않습니다.
        검색·게시·지원권은 성공한 작업에 사용합니다.
      </div>
      <div className="plans">
        {plans.map((p) => (
          <article
            key={p.sku}
            className={`plan ${p.sku === "job_post" ? "featured" : ""}`}
          >
            <span
              className="eyebrow"
              style={p.sku === "job_post" ? { color: "#d7ff45" } : {}}
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
      <p>
        <Link href="/dashboard">워크스페이스에서 구매 및 유효 기간 확인</Link>
      </p>
      <FeeSimulator />
    </section>
  );
}
