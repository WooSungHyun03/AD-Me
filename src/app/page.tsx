import { ChannelSearch } from "@/components/discovery-ui";
import { featuredYoutube } from "@/lib/featured-youtube";
import { YoutubeChannelCards } from "@/components/featured-youtube";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
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
      <section className="discovery-hero">
        <div className="wrap discovery-hero-inner">
          <h1>
            우리 브랜드다운
            <br />
            YouTube 크리에이터를 찾아보세요.
          </h1>
          <p>
            채널을 검색하고 공개 구독자 수와 최근 영상을 확인하세요. 등록된
            크리에이터에게는 AD Me에서 협업을 제안할 수 있습니다.
          </p>
          <ChannelSearch />
          {items.length > 0 && (
            <div className="discovery-chips" aria-label="인기 채널 바로 찾기">
              {items.map((channel) => (
                <Link
                  key={channel.channel_id}
                  href={`/creators?q=${encodeURIComponent(channel.title)}`}
                >
                  {channel.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      {items.length > 0 && (
        <section className="wrap section-line discovery-results">
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
      <section className="wrap discovery-workflows" aria-label="협업 시작">
        <Link href="/jobs">
          <strong>광고 공고</strong>
          <span>모집 중인 YouTube 협업 보기</span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/tools">
          <strong>AI 스튜디오</strong>
          <span>상품에 맞는 캠페인 초안 만들기</span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
        <Link href="/dashboard">
          <strong>협업 워크스페이스</strong>
          <span>제안, 메시지, 결과물 관리</span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
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
