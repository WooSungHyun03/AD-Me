import { ChannelSearch, PublicChannelFilters } from "@/components/discovery-ui";
import {
  readYoutubeDirectory,
  type YoutubeDirectoryPage,
} from "@/lib/youtube-directory";
import { YoutubeChannelCards } from "@/components/featured-youtube";
import Link from "next/link";
import { Suspense } from "react";
import { getConfig } from "@/lib/config";
import { Catalog } from "@/components/catalog";
import { promotionSlots } from "@/lib/promotions";
import { configured, currentUser, supabase } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
import { readMySavedCreatorCatalog } from "@/lib/creator-catalog-read";
import { parseCreatorFilters } from "@/lib/creator-filters";
import {
  readFilteredCatalog,
  type FilteredCatalog,
} from "@/lib/filtered-catalog";
export const metadata = {
  title: "크리에이터 탐색",
  alternates: { canonical: "/creators" },
};

export default async function Creators({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of Array.isArray(value) ? value : value ? [value] : [])
      query.append(key, v);
  const params = query;
  return (
    <>
      <section className="discovery-hero discovery-hero--compact figma-discovery-hero">
        <div className="wrap discovery-hero-inner">
          <p className="figma-eyebrow">DISCOVER YOUR NEXT PARTNER</p>
          <h1>우리 브랜드다운 유튜버, 여기서.</h1>
          <p>공식 YouTube 데이터로 채널과 최근 공개 영상을 확인하세요.</p>
          <ChannelSearch query={params.get("q") ?? ""} params={params} />
        </div>
      </section>
      <Suspense
        fallback={
          <section className="wrap discovery-results" aria-live="polite">
            <p>공개 채널과 등록 프로필을 불러오는 중입니다.</p>
          </section>
        }
      >
        <CreatorResults params={params} />
      </Suspense>
    </>
  );
}

async function CreatorResults({ params }: { params: URLSearchParams }) {
  const query = params;
  const filters = parseCreatorFilters(query),
    remote = configured();
  let initialPage: FilteredCatalog | undefined;
  if (remote) {
    try {
      initialPage = await readFilteredCatalog(
        await supabase(),
        filters,
        getConfig().serviceMode === "test_demo",
      );
    } catch {
      /* Client retry preserves the page and filter inputs. */
    }
  }
  let registeredUnavailable = remote && !initialPage;
  const items = remote
    ? (initialPage?.items ?? [])
    : await publicCreators().catch(() => {
        registeredUnavailable = true;
        return [];
      });
  let featured: YoutubeDirectoryPage | undefined;
  if (remote) {
    try {
      featured = await readYoutubeDirectory(await supabase(), params);
    } catch {
      /* Missing configuration/RPC and invalid cursors remain visible and recoverable. */
    }
  }
  const hot =
    getConfig().features.testBilling === "enabled"
      ? await promotionSlots(false)
      : [];
  let initialSaved: string[] = [];
  const user = await currentUser();
  if (user) {
    const db = await supabase();
    try {
      initialSaved = (await readMySavedCreatorCatalog(db)).map(
        (x) => x.creator_id,
      );
    } catch {
      /* Saving errors remain recoverable in the catalogue. */
    }
  }
  const channels = featured?.items ?? [];
  const firstQuery = new URLSearchParams(params);
  firstQuery.delete("yt-cursor");
  const nextQuery = new URLSearchParams(firstQuery);
  if (featured?.nextCursor) nextQuery.set("yt-cursor", featured.nextCursor);
  return (
    <>
      <section className="wrap discovery-results figma-directory-results">
        <div className="section-heading">
          <h2>공개 YouTube 채널</h2>
          <Link className="discovery-text-link" href="#registered-creators">
            등록 프로필 보기
          </Link>
        </div>
        <div className="figma-discovery-layout">
          <aside aria-label="공개 채널 필터">
            <details open className="figma-discovery-filters">
              <summary>상세 필터</summary>
              <PublicChannelFilters
                params={params}
                count={featured?.total ?? null}
              />
            </details>
          </aside>
          <div>
            {!featured ? (
              <p className="notice" role="alert">
                공개 채널을 불러오지 못했습니다. 연결 또는 검색 조건을
                확인해주세요.
              </p>
            ) : channels.length ? (
              <YoutubeChannelCards channels={channels} />
            ) : (
              <p className="empty">
                검색 조건과 일치하는 공개 채널이 없습니다.
              </p>
            )}
            {(params.has("yt-cursor") || featured?.nextCursor) && (
              <nav aria-label="공개 채널 페이지" className="inline">
                {params.has("yt-cursor") && (
                  <Link
                    className="button outline"
                    href={"/creators?" + firstQuery}
                  >
                    첫 페이지
                  </Link>
                )}
                {featured?.nextCursor && (
                  <Link
                    className="button outline"
                    href={"/creators?" + nextQuery}
                  >
                    다음 채널
                  </Link>
                )}
              </nav>
            )}
            <div className="figma-discovery-next">
              <h3>검색 조건만으로는 아쉽다면?</h3>
              <p>
                상품 설명과 광고 목표를 적고, 조건에 맞는 후보와 추천 근거를
                확인하세요.
              </p>
              <Link className="button primary" href="/#recommendation">
                AI 추천 알아보기
              </Link>
            </div>
          </div>
        </div>
      </section>
      <section id="registered-creators" className="wrap discovery-registered">
        <h2>AD Me 등록 프로필</h2>
        {registeredUnavailable && (
          <p className="notice" role="alert">
            등록 프로필 연결을 준비 중입니다.
          </p>
        )}
        <p>
          <Link href="/creators/youtube">소유권 확인 채널 검색</Link>
        </p>
        {hot.length > 0 && (
          <section className="panel" style={{ marginBottom: 24 }}>
            <span className="badge lime">스폰서 · HOT</span>
            <h3 style={{ marginTop: 15 }}>지금 주목할 크리에이터</h3>
            <p>스폰서 노출이며 일반 추천 순위에 영향을 주지 않습니다.</p>
            <div className="inline">
              {hot.map((h) => (
                <Link
                  className="button outline"
                  href={`/creators/${h.creator_id}`}
                  key={h.creator_id}
                >
                  {h.name} ↗
                </Link>
              ))}
            </div>
          </section>
        )}
        {
          <Suspense fallback={<p role="status">검색을 준비하고 있습니다.</p>}>
            <Catalog
              items={items}
              initialSaved={initialSaved}
              remote={remote}
              initialPage={initialPage}
              initialFilters={filters}
            />
          </Suspense>
        }
      </section>
    </>
  );
}
