import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { HomeAmbientMotion } from "@/components/home-ambient-motion";
import { RecommendationBrief } from "@/components/recommendation-brief";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { homeCatalogSchema } from "@/lib/home-catalog";

export const dynamic = "force-dynamic";
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  // D081: actual public counts and as-of time only; never the mockup's statistics.
  let summary: ReturnType<typeof homeCatalogSchema.parse> | null = null;
  if (configured()) {
    const { data, error } = await (
      await supabase()
    ).rpc("creator_home_summary", {
      p_demo: getConfig().serviceMode === "test_demo",
    });
    const parsed = homeCatalogSchema.safeParse(data);
    if (!error && parsed.success) summary = parsed.data;
  }
  return (
    <>
      <section className="product-hero premium-hero figma-home-hero">
        <div className="figma-hero-image">
          <Image
            src="/brand/figma/hero.png"
            alt=""
            width={1672}
            height={941}
            priority
            sizes="(max-width: 740px) 100vw, 1440px"
          />
        </div>
        <div className="figma-width figma-hero-copy">
          <p className="figma-eyebrow">YOUTUBE CREATORS, BETTER TOGETHER</p>
          <h1>
            브랜드의 다음 장면,
            <br />딱 맞는 크리에이터와.
          </h1>
          <p>
            상품을 소개할 YouTube 크리에이터를 찾고, 조건을 비교해 다음 캠페인을
            준비하세요.
          </p>
          <div className="figma-actions">
            <Link className="button primary" href="#recommendation">
              추천 조건 입력 <ArrowDown size={16} aria-hidden="true" />
            </Link>
            <Link className="button outline" href="/jobs">
              캠페인 둘러보기 <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
            <Link className="figma-hero-directory" href="/creators">
              채널 탐색
            </Link>
          </div>
          <p
            className="figma-hero-status"
            style={{ fontSize: 13, marginTop: 16 }}
          >
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
        </div>
        <HomeAmbientMotion />
      </section>
      <section className="figma-width figma-discover" aria-label="협업 과정">
        <h2>
          좋은 협업은,
          <br />
          좋은 발견에서.
        </h2>
        <p>
          <strong>Discover</strong>크리에이터를 살펴보세요.
        </p>
        <p>
          <strong>Match</strong>상품과 조건에 맞는 후보를 찾으세요.
        </p>
        <p>
          <strong>Create</strong>캠페인을 준비하고 협업하세요.
        </p>
      </section>
      <section className="figma-editorial">
        <div className="figma-width">
          <div className="figma-section-head">
            <div>
              <p className="figma-eyebrow">CREATOR IN FOCUS</p>
              <h2>다음 협업의 주인공을 만나보세요.</h2>
            </div>
            <Link className="button outline" href="/creators">
              전체 크리에이터 보기 <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="figma-two-columns">
            <Image
              src="/brand/figma/editorial.png"
              alt=""
              width={1672}
              height={941}
              sizes="(max-width: 740px) 90vw, 648px"
            />
            <div>
              <h3>채널의 콘텐츠를 먼저 살펴보세요.</h3>
              <p>
                YouTube 공개 정보와 최근 영상으로 협업 후보를 비교해 보세요.
                공개 채널의 AD Me 등록·협업 가능 여부는 별도입니다.
              </p>
              <Link className="button outline" href="/creators/youtube">
                채널 인사이트 살펴보기{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section className="figma-recommendation" id="recommendation">
        <div className="figma-width figma-two-columns" id="recommend">
          <div>
            <p className="figma-eyebrow">AI MATCHING</p>
            <h2>
              상품을 알려주면,
              <br />
              가능성이 보입니다.
            </h2>
            <p>
              상품 설명과 타깃, 콘텐츠 분야, 예산을 입력하고 추천 근거를
              확인하세요.
            </p>
            <Link className="button outline" href="/brand/products">
              상품 등록 <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <RecommendationBrief />
        </div>
      </section>
      <section className="figma-width figma-stages">
        <h2>발견 이후의 모든 순간도, 함께.</h2>
        <div>
          <article>
            <h3>후보를 비교하세요.</h3>
            <p>채널의 정보와 협업 조건을 나란히 살펴보세요.</p>
            <Link href="/compare">후보 비교</Link>
          </article>
          <article>
            <h3>캠페인을 준비하세요.</h3>
            <p>상품과 목표를 정리하고 협업 기회를 찾아보세요.</p>
            <Link href="/jobs">공개 캠페인</Link>
          </article>
          <article>
            <h3>협업을 이어가세요.</h3>
            <p>제안, 메시지, 결과물을 워크스페이스에서 확인하세요.</p>
            <Link href="/dashboard">워크스페이스</Link>
          </article>
        </div>
      </section>
      <section className="figma-editorial">
        <div className="figma-width figma-two-columns">
          <Image
            src="/brand/figma/creator-editorial.png"
            alt=""
            width={1672}
            height={941}
            sizes="(max-width: 740px) 90vw, 600px"
          />
          <div>
            <p className="figma-eyebrow">FOR CREATORS</p>
            <h2>
              나다운 콘텐츠가
              <br />
              좋은 기회를 만나도록.
            </h2>
            <p>내 채널에 맞는 캠페인을 찾아보세요.</p>
            <Link className="button primary" href="/jobs">
              캠페인 찾아보기 <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
      <section className="figma-width figma-faq">
        <h2>시작 전, 궁금한 이야기</h2>
        <details>
          <summary>YouTube 채널만 연결할 수 있나요?</summary>
          <p>AD Me는 YouTube 채널과의 협업을 지원합니다.</p>
        </details>
        <details>
          <summary>추천은 무엇을 바탕으로 하나요?</summary>
          <p>
            입력한 분야와 예산, 확인 가능한 채널 정보 및 협업 조건을 바탕으로
            후보를 보여드립니다.
          </p>
        </details>
        <details>
          <summary>무료로 이용할 수 있나요?</summary>
          <p>공개 채널 탐색과 캠페인 초안 작성을 무료로 시작할 수 있습니다.</p>
        </details>
      </section>
      <section className="figma-recommendation">
        <div className="figma-width figma-section-head">
          <h2>다음 캠페인에, 좋은 케미를.</h2>
          <Link className="button primary" href="/signup">
            무료로 시작하기 <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </section>
    </>
  );
}
