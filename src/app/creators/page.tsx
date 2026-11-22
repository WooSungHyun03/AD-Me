import { Catalog } from "@/components/catalog";
import { currentUser, supabase } from "@/lib/supabase";
import { searchCreators, searchSchema } from "@/lib/search";
import { PromotionSlot } from "@/components/promotion-slot";
export const metadata = {
  title: "크리에이터 탐색",
  alternates: { canonical: "/creators" },
};
export default async function Creators() {
  // First page only; further pages come from /api/creators (no full list sent to the browser).
  const initial = await searchCreators(searchSchema.parse({}));
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
      <span className="eyebrow">Discover creators</span>
      <h1 className="page-title">숫자 너머, 브랜드의 취향까지.</h1>
      <p>당신의 다음 캠페인에 어울리는 파트너를 발견하세요.</p>
      <div className="notice">
        DEMO 표식은 가상 데이터, 본인 등록 표식은 크리에이터가 직접 입력한
        정보입니다. 유료 HOT 노출은 추천 점수에 영향을 주지 않습니다.
      </div>
      <PromotionSlot />
      <Catalog initial={initial} initialSaved={initialSaved} />
    </section>
  );
}
