import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featuredYoutube } from "@/lib/featured-youtube";
import { YoutubeChannelCards } from "@/components/featured-youtube";
export default async function Home() {
  const { items } = await featuredYoutube("", null, 3);
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
        <div className="panel youtube-hero">
          <h2>공개 YouTube 채널을 한눈에</h2>
          <p>
            채널 구독자 수와 최근 공개 영상을 확인하고 다음 광고의 후보를
            살펴보세요.
          </p>
          <Link className="button outline" href="/creators">
            YouTube 채널 탐색 <ArrowUpRight size={17} />
          </Link>
        </div>
      </section>
      {items.length > 0 && (
        <section className="wrap section-line">
          <div className="section-heading">
            <h2>주목할 YouTube 채널</h2>
            <Link href="/creators" className="inline">
              전체 탐색 <ArrowUpRight size={18} />
            </Link>
          </div>
          <p>
            출처는 YouTube Data API입니다. 공개 채널의 AD Me 가입과 협업 가능
            여부는 확인되지 않았습니다.
          </p>
          <YoutubeChannelCards channels={items} />
        </section>
      )}
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
      </section>
    </>
  );
}
