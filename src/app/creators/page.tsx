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
export default async function Creators({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of Array.isArray(value) ? value : value ? [value] : [])
      query.append(key, v);
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
  return (
    <section className="wrap">
      <span className="eyebrow">Discover creators</span>
      <h1 className="page-title">숫자 너머, 브랜드의 취향까지.</h1>
      <p>당신의 다음 캠페인에 어울리는 파트너를 발견하세요.</p>
      <p>
        <Link href="/creators/youtube">확인된 YouTube 채널 검색</Link>
      </p>
      <div className="notice">
        DEMO 표식은 가상 데이터, 본인 등록 표식은 크리에이터가 직접 입력한
        정보입니다.
      </div>
      {hot.length > 0 && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <span className="badge lime">TEST 광고 · HOT</span>
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
      <Suspense
        fallback={<p role="status">크리에이터 검색을 준비하고 있습니다.</p>}
      >
        <Catalog
          items={items}
          initialSaved={initialSaved}
          remote={remote}
          initialPage={initialPage}
          initialFilters={filters}
        />
      </Suspense>
    </section>
  );
}
