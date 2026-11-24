import type { Metadata } from "next";
import Link from "next/link";
import { FigmaNavigation } from "@/components/figma-navigation";
import "./globals.css";
import "./marketplace-theme.css";
import "./figma-theme.css";
import { isDemoMode } from "@/lib/mode";
import { siteUrl } from "@/lib/seo";
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: "AD Me — 브랜드의 다음 파트너", template: "%s | AD Me" },
    description: "브랜드와 YouTube 크리에이터를 연결하는 광고 협업 플랫폼.",
    icons: { icon: "/brand/ad-me-symbol.png" },
    openGraph: {
      siteName: "AD Me",
      locale: "ko_KR",
      type: "website",
      images: [{ url: "/brand/ad-me-logo.png", alt: "AD Me" }],
    },
    // D083: the TEST demo environment is never indexed.
    ...(isDemoMode() && { robots: { index: false, follow: false } }),
  };
}
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
        <FigmaNavigation />
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="figma-footer">
          <span>© 2026 AD Me · YouTube 크리에이터 협업</span>
          <nav aria-label="서비스 안내">
            <Link href="/about">서비스·데이터 안내</Link>
            <Link href="/help">도움말·문의</Link>
            <Link href="/privacy">개인정보 처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/licenses">오픈소스 고지</Link>
          </nav>
        </footer>
      </body>
    </html>
  );
}
