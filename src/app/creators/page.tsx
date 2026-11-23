import Link from "next/link";
import { Catalog } from "@/components/catalog";
import { currentUser, supabase } from "@/lib/supabase";
import { searchCreators, searchSchema } from "@/lib/search";
import { PromotionSlot } from "@/components/promotion-slot";
import { featuredYoutube } from "@/lib/featured-youtube";
import { YoutubeChannelCards } from "@/components/featured-youtube";
export const metadata = {
  title: "크리에이터 탐색",
  alternates: { canonical: "/creators" },
};
export default async function Creators({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 80) : "";
  // Registered profiles: first page only; further pages come from /api/creators.
  const [initial, featured] = await Promise.all([
    searchCreators(searchSchema.parse({})),
    featuredYoutube(query),
  ]);
  let initialSaved: string[] = [];
  const user = await currentUser();
  if (user) {
    const db = await supabase();
    await db.rpc("track_explore"); // D006: one pseudonymous event per day, no search terms
    const { data } = await db
      .from("saved_list_items")
      .select("creator_id,saved_lists!inner(is_default)")
      .eq("owner_id", user.id)
      .eq("saved_lists.is_default", true);
    initialSaved = data?.map((x) => x.creator_id) ?? [];
  }
  return (
    <section className="wrap">
      <h1 className="page-title">YouTube 크리에이터 탐색</h1>
      <p>유명 채널의 구독자 수와 최근 공개 영상을 확인하세요.</p>
      <form action="/creators" method="get" className="form ops-form">
        <label>
          채널 이름
          <input type="search" name="q" maxLength={80} defaultValue={query} />
        </label>
        <button className="button outline">검색</button>
      </form>
      <p>
        YouTube Data API 제공 정보입니다. 이 공개 채널의 AD Me 가입과 협업 가능
        여부는 확인되지 않았습니다.
      </p>
      {featured.unavailable ? (
        <p role="alert">공개 채널을 불러오지 못했습니다.</p>
      ) : featured.items.length ? (
        <YoutubeChannelCards channels={featured.items} />
      ) : (
        <p className="empty">검색 조건과 일치하는 공개 채널이 없습니다.</p>
      )}
      <section className="ops-section">
        <h2>AD Me 등록 프로필</h2>
        <p>
          <Link href="/creators/youtube">소유권 확인 채널 검색</Link>
        </p>
        <div className="notice">
          DEMO 표식은 가상 데이터, 본인 등록 표식은 크리에이터가 직접 입력한
          정보입니다. 유료 HOT 노출은 추천 점수에 영향을 주지 않습니다.
        </div>
        <PromotionSlot />
        <Catalog initial={initial} initialSaved={initialSaved} />
      </section>
    </section>
  );
}
