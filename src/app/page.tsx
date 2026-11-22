import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { creators } from "@/lib/catalog";
import { isDemoMode } from "@/lib/mode";
import { PromotionSlot } from "@/components/promotion-slot";
export const metadata = {
  alternates: { canonical: "/" },
};
export default function Home() {
  return (
    <>
      <section className="wrap hero">
        <div>
          <span className="eyebrow">
            Creator intelligence, human connection
          </span>
          <h1>
            우리 브랜드다운
            <br />
            크리에이터를
            <br />
            만나는 방법.
          </h1>
          <p>
            숫자 너머의 분위기까지.
            <br />
            발견부터 검토, 제안까지 하나의 흐름으로 연결하세요.
          </p>
          <div className="inline" style={{ marginTop: 32 }}>
            <Button asChild>
              <Link href="/creators">
                크리에이터 찾기 <ArrowUpRight size={18} />
              </Link>
            </Button>
            <Link className="button ghost" href="/campaigns/new">
              캠페인 시작하기 <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="hero-art" aria-label="가상 크리에이터 일러스트">
          <div className="art-note">
            <b>분위기로 발견하고,</b>근거로 결정하세요.
          </div>
          <div className="poster">
            <div className="portrait" />
            <strong>
              자연스럽게,
              <br />
              나답게.
            </strong>
            <small>BEAUTY · LIFESTYLE / DEMO</small>
          </div>
          <div className="poster">
            <div className="portrait" />
            <strong>
              새로운 시선,
              <br />
              다음의 취향.
            </strong>
            <small>FASHION · CREATIVE / DEMO</small>
          </div>
        </div>
      </section>
      <section className="wrap section-line">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Discover your next fit</div>
            <h2 style={{ margin: "15px 0 0" }}>
              브랜드의 결을 닮은 크리에이터
            </h2>
          </div>
          <Link href="/creators" className="inline">
            전체 탐색 <ArrowUpRight size={18} />
          </Link>
        </div>
        <PromotionSlot />
        <div className="creator-grid">
          {(isDemoMode() ? creators.slice(1, 4) : []).map((c, i) => (
            <Link
              key={c.seed_id}
              href={`/creators/${c.seed_id}`}
              className="creator"
            >
              <div
                className="creator-visual"
                style={{ background: ["#dde3cc", "#e6ddcd", "#d6dad8"][i] }}
              >
                <span className="badge">가상 프로필 · DEMO</span>
                {c.name.slice(1)}
              </div>
              <div className="creator-top">
                <h3>{c.name}</h3>
                <ArrowUpRight size={19} />
              </div>
              <p>
                {c.categories.join(" · ")} / {c.platforms.join(" · ")}
              </p>
              <div className="tags">
                {c.vibes.map((t) => (
                  <span key={t} className="badge">
                    {t}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="band">
        <div className="wrap">
          <div className="eyebrow" style={{ color: "#d7ff45" }}>
            From discovery to collaboration
          </div>
          <h2 style={{ marginTop: 20 }}>
            흩어져 있던 협업의 과정,
            <br />
            이제 한곳에서.
          </h2>
          <div className="steps">
            <div>
              <span>01 / DISCOVER</span>
              <h3>감각에 맞는 발견</h3>
              <p>
                분야, 플랫폼, 분위기, 예산.
                <br />
                원하는 조건으로 후보를 좁혀보세요.
              </p>
            </div>
            <div>
              <span>02 / UNDERSTAND</span>
              <h3>설명할 수 있는 추천</h3>
              <p>
                일치하는 태그부터 부족한 데이터까지.
                <br />
                점수의 이유를 투명하게 확인하세요.
              </p>
            </div>
            <div>
              <span>03 / CONNECT</span>
              <h3>대화로 이어지는 매칭</h3>
              <p>
                제안, 수락, 결과물 검토.
                <br />
                함께 일하는 모든 순간을 연결합니다.
              </p>
            </div>
          </div>
        </div>
      </section>
      <section className="wrap">
        <div className="section-heading">
          <h2>
            다음 캠페인의 시작,
            <br />
            좋은 파트너와 함께.
          </h2>
          <Button asChild>
            <Link href="/signup">
              무료로 시작하기 <ArrowUpRight size={18} />
            </Link>
          </Button>
        </div>
        <p style={{ fontSize: 12 }}>
          {isDemoMode()
            ? "현재 카탈로그는 가상 크리에이터 48명의 시연 데이터입니다. 실제 인물·광고 성과와 무관합니다."
            : "무료 베타 서비스입니다. 본인이 등록·공개한 프로필만 표시합니다."}
        </p>
      </section>
    </>
  );
}
