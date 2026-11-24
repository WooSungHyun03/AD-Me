"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { Menu } from "lucide-react";

const pages = [
  { href: "/creators", label: "크리에이터 탐색" },
  { href: "/#recommendation", label: "AI 추천" },
  { href: "/jobs", label: "캠페인" },
  { href: "/pricing", label: "요금제" },
  { href: "/dashboard", label: "워크스페이스" },
];

export function FigmaNavigation() {
  const mobileMenu = useRef<HTMLDetailsElement>(null);
  function closeMenu() {
    if (mobileMenu.current) mobileMenu.current.open = false;
  }
  return (
    <header className="figma-nav">
      <Link href="/" aria-label="AD Me 홈" className="figma-logo">
        <Image
          src="/brand/figma/logo.png"
          alt="AD Me"
          width={207}
          height={69}
          priority
        />
      </Link>
      <nav className="figma-nav-links" aria-label="메인 메뉴">
        {pages.map(({ href, label }) => (
          <Link key={href} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="figma-nav-account">
        <Link href="/login">로그인</Link>
        <Link className="button primary" href="/signup">
          무료로 시작하기
        </Link>
      </div>
      <details
        ref={mobileMenu}
        className="figma-mobile-menu"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            closeMenu();
            mobileMenu.current?.querySelector("summary")?.focus();
          }
        }}
      >
        <summary>
          탐색 <Menu size={20} aria-hidden="true" />
        </summary>
        <nav aria-label="모바일 전체 메뉴" onClick={closeMenu}>
          {pages.map(({ href, label }) => (
            <Link className="button outline" key={href} href={href}>
              {label}
            </Link>
          ))}
          <Link className="button outline" href="/login">
            로그인
          </Link>
          <Link className="button outline" href="/signup">
            회원가입
          </Link>
        </nav>
      </details>
    </header>
  );
}
