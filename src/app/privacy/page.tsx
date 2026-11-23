import Link from "next/link";
import { policyDocument } from "@/lib/consent";
export default function Privacy() {
  const { version, content: c } = policyDocument;
  return (
    <section className="wrap prose">
      <h1 className="page-title">개인정보 처리 안내</h1>
      <p>검토 버전 {version}</p>
      <p className="notice">{c.review}</p>
      <h2>수집하는 정보와 목적</h2>
      <p>
        {c.account} {c.collaboration} {c.source}
      </p>
      <h2>보관과 공개</h2>
      <p>
        {c.retention} 공개로 설정한 자료만 공개하며 제안·메시지·주문은 현재
        권한을 확인합니다. 가상 시연 데이터는 실존 인물과 무관합니다.
      </p>
      <h2>처리 서비스</h2>
      <p>
        {c.processors} TEST 결제는 별도 격리 환경에서만 제공하며 카드번호를 AD
        Me에 저장하지 않습니다.
      </p>
      <h2>사용자의 선택</h2>
      <p>
        {c.rights} {c.adult} 민감한 개인정보를 프로필·메시지·결과물에 입력하지
        마세요.
      </p>
      <h2>운영자 및 권리 요청 연락처</h2>
      <p>운영자: 우성현</p>
      <p>
        지원·신고·열람·정정·삭제 요청:{" "}
        <a href="mailto:2242798@donga.ac.kr">2242798@donga.ac.kr</a>
      </p>
      <p>
        요청 시 대상 프로필 또는 자료의 주소와 요청 내용을 알려주세요. 비밀번호,
        인증 코드, API 키, 신분증 원본은 이메일에 첨부하지 마세요. 타인의
        개인정보가 포함된 요청은 필요한 최소 범위만 기재해주세요.
      </p>
      <div className="notice">
        약관·개인정보 안내·성인 자기확인은 각각 서버 시각과 버전으로 기록합니다.
        공개 철회는 이후 공개를 중단하며 자료 전체 삭제와 구분합니다. 설정에서
        자신의 최근 확인·철회 기록을 확인할 수 있습니다.
      </div>
      <p>
        <Link href="/terms">이용약관 검토본</Link>
      </p>
    </section>
  );
}
