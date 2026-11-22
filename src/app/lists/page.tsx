import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import {
  ImportCsv,
  ListControls,
  NewListForm,
  RemoveItem,
} from "@/components/lists";
export default async function Lists() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  const db = await supabase();
  await db.rpc("ensure_default_list");
  const { data: lists } = await db
    .from("saved_lists")
    .select(
      "id,name,is_default,campaign_id,saved_list_items(creator_id,creators(profile))",
    )
    .order("is_default", { ascending: false })
    .order("created_at");
  return (
    <section className="wrap">
      <span className="eyebrow">Shortlists</span>
      <h1 className="page-title">후보 그룹</h1>
      <p>
        즐겨찾기(♡)는 기본 목록에 담깁니다. 그룹과 캠페인 후보 목록은 본인만 볼
        수 있습니다.
      </p>
      <NewListForm />
      {lists?.map((l) => (
        <article
          className="panel"
          style={{ marginTop: 20 }}
          key={l.id}
          data-testid="saved-list"
        >
          <div className="inline" style={{ justifyContent: "space-between" }}>
            <h3 style={{ margin: 0 }}>
              {l.name} {l.is_default && <span className="badge">기본</span>}
              {l.campaign_id && (
                <Link
                  className="badge lime"
                  href={`/campaigns/${l.campaign_id}`}
                >
                  캠페인 후보
                </Link>
              )}
            </h3>
            <ListControls id={l.id} name={l.name} locked={l.is_default} />
          </div>
          {l.saved_list_items.length ? (
            l.saved_list_items.map((i) => {
              const profile = (
                i.creators as unknown as { profile: { name: string } } | null
              )?.profile;
              return (
                <div className="result" key={i.creator_id}>
                  <span>↗</span>
                  <Link href={`/creators/${i.creator_id}`}>
                    {profile?.name ?? i.creator_id}
                  </Link>
                  <RemoveItem
                    listId={l.id}
                    creatorId={i.creator_id}
                    name={profile?.name ?? i.creator_id}
                  />
                </div>
              );
            })
          ) : (
            <p className="empty">아직 담긴 크리에이터가 없습니다.</p>
          )}
          <ImportCsv listId={l.id} name={l.name} />
        </article>
      ))}
    </section>
  );
}
