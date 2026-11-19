"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="wrap">
      <h1 className="page-title">잠시 연결이 원활하지 않습니다.</h1>
      <p>요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      <button className="button primary" onClick={() => reset()}>
        다시 시도
      </button>
    </section>
  );
}
