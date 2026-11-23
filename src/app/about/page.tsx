import Link from "next/link";
export const metadata = {
  title: "서비스·데이터 안내",
  alternates: { canonical: "/about" },
};
export default function About() {
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
        가져옵니다. AD Me 등록과 협업 가능 여부는 별도입니다. DEMO로 표시된
        캠페인은 시연 자료입니다.
      </p>
      <h2>추천 점수</h2>
      <p>
        분위기 28%, 분야 25%, 타깃 20%, 예산 15%, 형식 12%를 기본 가중치로
        사용합니다. 미확보 데이터는 제외하고 가중치를 재정규화하며 데이터
        충족률을 함께 표시합니다. 협업 불가·비공개 프로필은 추천에서 제외합니다.
        HOT 유료 노출은 추천 점수를 바꾸지 않습니다.
      </p>
      <h2>브랜드 안전성</h2>
      <p>
        자료 부재는 안전 보증이 아닙니다. 확인 가능한 출처에 기반한 관리자
        검토를 원칙으로 하며 미확인 논란을 자동 생성하지 않습니다. 정정·신고는
        각 프로필에서 접수합니다.
      </p>
      <h2>TEST 결제</h2>
      <p>
        Toss Payments TEST 키만 사용합니다. 실제 과금이나 자동 갱신은 없습니다.
        이용권은 승인 후 30일간 유효합니다. 팀 초대·고급 AI 분석 등 준비 중인
        기능은 별도 표시합니다.
      </p>
      <h2>도움말·문의</h2>
      <p>
        이용 방법, 데이터 한계, 문의 접수는{" "}
        <Link href="/help">도움말·문의</Link>
        에서 확인하세요.
      </p>
    </section>
  );
}
