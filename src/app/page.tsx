import { featuredYoutube } from "@/lib/featured-youtube";
import { YoutubeChannelCards } from "@/components/featured-youtube";
import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { creators } from "@/lib/catalog";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { projectPublicCreator } from "@/lib/creator-public-profile";
import { homeCatalogSchema } from "@/lib/home-catalog";
export const dynamic = "force-dynamic";
export default async function Home() {
  const demoMode = getConfig().serviceMode === "test_demo";
  let summary: ReturnType<typeof homeCatalogSchema.parse> | null = null;
  if (configured()) {
    const db = await supabase(),
      { data, error } = await db.rpc("creator_home_summary", {
        p_demo: demoMode,
      });
    const parsed = homeCatalogSchema.safeParse(data);
    if (!error && parsed.success) summary = parsed.data;
  } else if (demoMode) {
    const samples = creators
      .map((c) =>
        projectPublicCreator({
          id: c.seed_id,
          published: c.published,
          profile: c,
        }),
      )
      .filter((c) => c !== null);
    summary = homeCatalogSchema.parse({
      version: 1,
      total: samples.length,
      demo: samples.length,
      registered: 0,
      asOf: new Date().toISOString(),
      featured: samples.slice(0, 3),
    });
  }
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
        <p style={{ fontSize: 12 }}>
          {summary
            ? `현재 공개 프로필 ${summary.total}명 · 본인 등록 ${summary.registered}명${summary.demo ? ` · 가상 시연 ${summary.demo}명` : ""}. 본인 등록은 플랫폼 소유·지표 검증 완료를 뜻하지 않습니다.`
            : "현재 공개 현황은 확인 중입니다. 확보 인원이나 성과를 추정해 표시하지 않습니다."}
          {summary && (
            <>
              <br />
              집계 시각{" "}
              {new Date(summary.asOf).toLocaleString("ko-KR", {
                timeZone: "Asia/Seoul",
              })}{" "}
              (KST) · 무료 베타 · 공개 범위에 따라 변경됩니다.
            </>
          )}
        </p>
      </section>
    </>
  );
}
