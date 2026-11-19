import Link from "next/link";
export default function NotFound() {
  return (
    <section className="wrap">
      <span className="eyebrow">404 / Not found</span>
      <h1 className="page-title">찾으시는 페이지가 없습니다.</h1>
      <p>주소를 확인하거나 새로운 크리에이터를 만나보세요.</p>
      <Link className="button primary" href="/creators">
        크리에이터 탐색
      </Link>
    </section>
  );
}
