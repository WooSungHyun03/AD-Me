import {
  ChannelSearch,
  PublicChannelFilters,
  filterPublicChannels,
} from "@/components/discovery-ui";
import { featuredYoutube } from "@/lib/featured-youtube";
import { YoutubeChannelCards } from "@/components/featured-youtube";
import Link from "next/link";
import { Suspense } from "react";
import { getConfig } from "@/lib/config";
import { Catalog } from "@/components/catalog";
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
      <section className="discovery-hero discovery-hero--compact">
        <div className="wrap discovery-hero-inner">
          <h1>YouTube 크리에이터 탐색</h1>
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
  const items = remote ? (initialPage?.items ?? []) : await publicCreators();
  const featured = await featuredYoutube(filters.query.slice(0, 80));
  let hot: {
    creator_id: string;
    profile: { name: string };
    expires_at: string;
  }[] = [];
  if (getConfig().features.testBilling === "enabled") {
    const db = await supabase();
    const { data } = await db.rpc("active_hot_creators");
    hot = data ?? [];
  }
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
  const channels = filterPublicChannels(featured.items, params);
  return (
    <>
      <section className="wrap discovery-results">
        <div className="section-heading">
          <h2>공개 YouTube 채널</h2>
          <Link className="discovery-text-link" href="#registered-creators">
            등록 프로필 보기
          </Link>
        </div>
        <PublicChannelFilters params={params} count={channels.length} />
        {featured.unavailable ? (
          <p className="notice" role="alert">
            공개 채널을 불러오지 못했습니다.
          </p>
        ) : channels.length ? (
          <YoutubeChannelCards channels={channels} />
        ) : (
          <p className="empty">검색 조건과 일치하는 공개 채널이 없습니다.</p>
        )}
      </section>
      <section id="registered-creators" className="wrap discovery-registered">
        <h2>AD Me 등록 프로필</h2>
        <p>
          <Link href="/creators/youtube">소유권 확인 채널 검색</Link>
        </p>
        {hot.length > 0 && (
          <section className="panel" style={{ marginBottom: 24 }}>
            <span className="badge lime">스폰서 · HOT</span>
            <h3 style={{ marginTop: 15 }}>지금 주목할 크리에이터</h3>
            <p>
              활성 TEST 이용권의 별도 노출입니다. 아래 일반 추천 순위와
              무관합니다.
            </p>
            <div className="inline">
              {hot.map((h) => (
                <Link
                  className="button outline"
                  href={`/creators/${h.creator_id}`}
                  key={h.creator_id}
                >
                  {h.profile.name} ↗
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
