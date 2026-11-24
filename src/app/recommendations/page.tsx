import Image from "next/image";
import Link from "next/link";
import { RecommendationBrief } from "@/components/recommendation-brief";

export const metadata = { title: "AI 추천", alternates: { canonical: "/recommendations" } };

export default function Recommendations() {
  return (
    <section className="figma-width figma-workspace figma-matching">
      <p className="figma-eyebrow">AI 추천</p>
      <h1 className="page-title">어떤 브랜드 이야기를 전하고 싶나요?</h1>
      <p>상품과 협업 조건을 알려주시면 맞는 유튜버와 추천 이유를 함께 보여드려요.</p>
      <div className="figma-matching-layout">
        <RecommendationBrief />
        <aside aria-label="추천 기준" className="figma-matching-aside">
          <Image
            src="/brand/figma/editorial.png"
            alt=""
            width={1672}
            height={941}
            sizes="(max-width: 740px) 90vw, 500px"
          />
          <div className="figma-workspace-panel">
            <h2>우리 브랜드와 맞는 채널</h2>
            <ul>
              <li>상품과 콘텐츠의 주제 적합성</li>
              <li>공개된 프로필과 제작 조건</li>
              <li>예산 안에서 협의할 수 있는 후보</li>
            </ul>
            <Link href="/creators" className="button outline">크리에이터 둘러보기</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
