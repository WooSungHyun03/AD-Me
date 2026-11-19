import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "AD Me — 브랜드의 다음 파트너", template: "%s | AD Me" },
  description: "분위기로 발견하고, 근거로 결정하는 크리에이터 협업 플랫폼.",
  icons: { icon: "/brand/ad-me-symbol.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <a className="skip" href="#main">
          본문으로 이동
        </a>
        <header>
          <Link href="/" aria-label="AD Me 홈" className="brand-lockup">
            <Image
              src="/brand/ad-me-symbol.png"
              width={43}
              height={43}
              alt=""
              priority
            />
            <Image
              src="/brand/ad-me-wordmark.png"
              width={132}
              height={51}
              alt="AD Me"
              priority
            />
          </Link>
          <nav aria-label="메인 메뉴">
            <Link href="/creators">크리에이터 탐색</Link>
            <Link href="/campaigns">캠페인</Link>
            <Link href="/tools">AI 스튜디오</Link>
            <Link href="/pricing">요금제</Link>
          </nav>
          <Link className="button outline small" href="/dashboard">
            내 워크스페이스 <span>↗</span>
          </Link>
        </header>
        <main id="main">{children}</main>
        <footer>
          <div>
            <Image
              src="/brand/ad-me-wordmark.png"
              width={105}
              height={41}
              alt="AD Me"
            />
            <p>좋은 브랜드와 좋은 크리에이터가 만나는 곳.</p>
          </div>
          <div>
            <Link href="/about">서비스·데이터 안내</Link>
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/login">로그인</Link>
            <span>© 2026 AD Me · 대학 프로젝트 · TEST 결제 전용</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
