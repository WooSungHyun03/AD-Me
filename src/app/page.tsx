import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Megaphone,
  Search,
  UsersRound,
} from "lucide-react";
import { HomeAmbientMotion } from "@/components/home-ambient-motion";
import { RecommendationBrief } from "@/components/recommendation-brief";
import { YoutubeImage } from "@/components/youtube-image";
import { featuredYoutube, youtubeCount } from "@/lib/featured-youtube";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

const workflows = [
  {
    href: "/creators",
    title: "크리에이터 탐색",
    description: "공개 채널의 구독자, 최근 영상과 주제를 살펴보세요.",
    Icon: Search,
  },
  {
    href: "/jobs",
    title: "광고 공고",
    description: "YouTube 협업을 제안하거나 모집 중인 공고에 지원하세요.",
    Icon: Megaphone,
  },
  {
    href: "/dashboard",
    title: "협업 워크스페이스",
    description: "협업 제안, 대화와 결과물 검토를 한곳에서 관리하세요.",
    Icon: UsersRound,
  },
];

async function HomeChannelPreview() {
  const { items, unavailable } = await featuredYoutube("", null, 3);
  return (
    <section
      className="channel-preview"
      aria-labelledby="channel-preview-title"
    >
      <div className="channel-preview-header">
        <h2 id="channel-preview-title">공개 YouTube 채널</h2>
        <span>구독자</span>
      </div>
      {items.length ? (
        <ul>
          {items.map((channel) => (
            <li key={channel.channel_id}>
              <Link href={`/creators/youtube/${channel.channel_id}`}>
                <YoutubeImage src={channel.metadata?.avatar} kind="avatar" />
                <strong>{channel.title}</strong>
                <span>{youtubeCount(channel.subscriber_count)}</span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {unavailable
            ? "채널 정보를 불러오지 못했습니다."
            : "표시할 공개 채널이 없습니다."}
        </p>
      )}
      <p className="channel-preview-source">
        YouTube Data API · 공개 채널의 협업 가능 여부는 미확인
      </p>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <section className="product-hero premium-hero">
        <HomeAmbientMotion />
        <div className="wrap premium-hero-grid">
          <div className="premium-hero-copy">
            <h1>
              우리 브랜드다운
              <br />
              유튜버를 찾으세요.
            </h1>
            <p>
              상품과 예산에 맞는 협업 후보를 찾고, 실제 YouTube 채널에서
              콘텐츠를 확인하세요.
            </p>
            <div className="premium-hero-actions">
              <Link className="button primary" href="#recommendation">
                추천 조건 입력 <ArrowDown size={17} aria-hidden="true" />
              </Link>
              <Link className="premium-hero-link" href="/creators">
                채널 탐색 <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <Suspense
            fallback={
              <section
                className="channel-preview channel-preview-loading"
                aria-label="공개 YouTube 채널"
              >
                <div className="channel-preview-header">
                  <h2>공개 YouTube 채널</h2>
                  <span>구독자</span>
                </div>
                <p role="status">공개 채널을 불러오는 중입니다.</p>
              </section>
            }
          >
            <HomeChannelPreview />
          </Suspense>
        </div>
      </section>
      <section
        className="wrap premium-recommendation"
        id="recommendation"
        aria-labelledby="recommendation-title"
      >
        <div>
          <h2 id="recommendation-title">광고할 상품부터 알려주세요.</h2>
          <p>
            등록 크리에이터의 견적과 협업 상태를 조건과 비교합니다. 관련 주제로
            분류된 공개 채널도 함께 확인할 수 있습니다.
          </p>
        </div>
        <RecommendationBrief />
      </section>
      <section
        className="wrap premium-workflows"
        aria-labelledby="workflow-title"
      >
        <h2 id="workflow-title">후보 발굴부터 협업까지</h2>
        <div className="premium-workflow-grid">
          {workflows.map(({ href, title, description, Icon }) => (
            <Link href={href} key={href}>
              <Icon aria-hidden="true" size={23} />
              <h3>{title}</h3>
              <p>{description}</p>
              <ArrowUpRight aria-hidden="true" size={19} />
            </Link>
          ))}
        </div>
      </section>
      <section className="product-paths" aria-labelledby="product-paths-title">
        <div className="wrap product-paths-inner">
          <h2 id="product-paths-title">협업을 시작하는 두 가지 방법</h2>
          <div className="product-paths-grid">
            <article>
              <h3>브랜드에서 캠페인을 준비한다면</h3>
              <ol>
                <li>광고할 상품과 예산을 등록합니다.</li>
                <li>추천 근거와 후보 채널을 비교합니다.</li>
                <li>선택한 크리에이터에게 협업을 제안합니다.</li>
              </ol>
              <Link className="premium-hero-link" href="/brand/products">
                상품 등록 <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </article>
            <article>
              <h3>YouTube 채널을 운영한다면</h3>
              <ol>
                <li>프로필에서 채널 소유권을 인증합니다.</li>
                <li>채널에 맞는 광고 공고를 확인합니다.</li>
                <li>지원 내역과 협업을 대시보드에서 관리합니다.</li>
              </ol>
              <Link className="premium-hero-link" href="/jobs">
                공고 찾아보기 <ArrowUpRight size={17} aria-hidden="true" />
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className="wrap premium-next">
        <div>
          <h2>다음 캠페인을 준비하세요.</h2>
          <p>탐색과 캠페인 초안을 무료로 이용할 수 있습니다.</p>
        </div>
        <div>
          <Link className="button outline" href="/pricing">
            요금제 보기
          </Link>
          <Link className="button primary" href="/signup">
            무료로 시작하기
          </Link>
        </div>
      </section>
    </>
  );
}
