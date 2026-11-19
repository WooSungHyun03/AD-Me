import Link from "next/link";
export default function Fail() {
  return (
    <section className="wrap">
      <h1 className="page-title">결제가 완료되지 않았습니다.</h1>
      <p>
        결제 취소 또는 오류로 이용권이 활성화되지 않았습니다. 요금제에서 다시
        시도해주세요.
      </p>
      <Link className="button primary" href="/pricing">
        요금제로 돌아가기
      </Link>
    </section>
  );
}
