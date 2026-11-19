import { Catalog } from "@/components/catalog";
import { publicCreators } from "@/lib/data";
export default async function Creators() {
  const items = await publicCreators();
  return (
    <section className="wrap">
      <span className="eyebrow">Discover creators</span>
      <h1 className="page-title">숫자 너머, 브랜드의 취향까지.</h1>
      <p>당신의 다음 캠페인에 어울리는 파트너를 발견하세요.</p>
      <div className="notice">
        DEMO 표식은 가상 데이터, 본인 등록 표식은 크리에이터가 직접 입력한
        정보입니다. 유료 HOT 노출은 추천 점수에 영향을 주지 않습니다.
      </div>
      <Catalog items={items} />
    </section>
  );
}
