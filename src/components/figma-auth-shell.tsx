import Image from "next/image";
import type { ReactNode } from "react";

export function FigmaAuthShell({ children }: { children: ReactNode }) {
  return (
    <section className="figma-width figma-auth-layout">
      <aside className="figma-auth-editorial" aria-label="AD Me 소개">
        <Image
          src="/brand/figma/hero.png"
          width={1672}
          height={941}
          alt=""
          sizes="(max-width: 780px) 1px, 650px"
        />
        <h2>
          좋은 브랜드와 좋은 크리에이터,
          <br />
          다음 장면을 함께.
        </h2>
        <p>AD Me에서 시작하는 새로운 연결.</p>
      </aside>
      <div className="auth figma-auth-panel">{children}</div>
    </section>
  );
}
