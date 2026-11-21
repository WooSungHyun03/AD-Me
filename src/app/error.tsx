"use client";
import { useEffect, useRef } from "react";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <section className="wrap">
      <h1 className="page-title" tabIndex={-1} ref={heading}>
        잠시 연결이 원활하지 않습니다.
      </h1>
      <p>요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      <button className="button primary" onClick={() => reset()}>
        다시 시도
      </button>
    </section>
  );
}
