import Link from "next/link";
import { Suspense } from "react";
import { getConfig } from "@/lib/config";
import { Catalog } from "@/components/catalog";
import { currentUser, supabase } from "@/lib/supabase";
import { publicCreators } from "@/lib/data";
export default async function Creators() {
  const items = await publicCreators();
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
    const { data } = await db
      .from("saved_creators")
      .select("creator_id")
      .eq("owner_id", user.id);
    initialSaved = data?.map((x) => x.creator_id) ?? [];
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
        <Catalog items={items} initialSaved={initialSaved} />
      </Suspense>
    </section>
  );
}
