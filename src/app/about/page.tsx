import { testProductTerms } from "@/lib/billing";
import { getTestProducts } from "@/lib/test-products";
import {
  creatorPlatforms,
  matchingFactors,
  platformLabels,
} from "@/lib/service-catalog";

export const dynamic = "force-dynamic";

export default async function About() {
  const test = await getTestProducts();
  return (
    <section className="wrap prose">
      <h1 className="page-title">AD Me 서비스·데이터 안내</h1>
      <p>
        AD Me는 브랜드와 크리에이터의 탐색·추천·협업을 연결하는 대학
        프로젝트입니다.
      </p>
      <h2>채널 데이터와 출처</h2>
      <p>
        공개 채널의 이름, 구독자 수, 최근 영상은 YouTube Data API에서
        가져옵니다. 공개 채널의 AD Me 등록과 협업 가능 여부는 채널별로 확인할 수
        있습니다.
      </p>
      <h2>SNS 플랫폼</h2>
      <p>
        {creatorPlatforms
          .map((platform) => platformLabels[platform])
          .join(", ")}
        을 등록·검색 조건으로 선택할 수 있습니다. 외부 계정 연동과 지표 자동
        수집은 준비 중입니다.
      </p>
      <h2>추천 점수</h2>
      <p>
        {Object.values(matchingFactors)
          .map(({ factor, weight }) => `${factor} ${weight}%`)
          .join(", ")}
        를 기본 가중치로 사용합니다. 미확보 데이터는 제외하고 가중치를
        재정규화하며 데이터 충족률을 함께 표시합니다. 협업 불가·비공개 프로필은
        추천에서 제외합니다.
      </p>
      <h2>브랜드 안전성</h2>
      <p>
        자료 부재는 안전 보증이 아닙니다. 확인 가능한 출처에 기반한 관리자
        검토를 원칙으로 하며 미확인 논란을 자동 생성하지 않습니다. 정정·신고는
        각 프로필에서 접수합니다.
      </p>
      {test && test.products.length > 0 && (
        <>
          <h2>TEST 상품 안내</h2>
          <p>
            이 환경의 TEST 상품은 실제 청구 없이 이용권과 크레딧 승인 흐름을
            검증합니다.
          </p>
          <ul>
            {test.products.map((product) => (
              <li key={product.sku}>
                {product.name} · {testProductTerms(product)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
