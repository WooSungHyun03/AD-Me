import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, supabase } from "@/lib/supabase";
import { itemLabel, readSavedLists } from "@/lib/saved-lists";
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
  const lists = await readSavedLists(db);
  return (
    <section className="wrap">
      <span className="eyebrow">Shortlists</span>
      <h1 className="page-title">후보 그룹</h1>
      <p>
        즐겨찾기(♡)는 기본 목록에 담깁니다. 그룹과 캠페인 후보 목록은 본인만 볼
        수 있습니다.
      </p>
      <NewListForm />
      {!lists && (
        <p className="notice" role="alert">
          후보 그룹을 불러오지 못했습니다. 잠시 후 새로고침해주세요.
        </p>
      )}
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
          {l.items.length ? (
            l.items.map((i) => (
              <div className="result" key={i.ref}>
                <span>↗</span>
                {i.visible ? (
                  <Link href={`/creators/${encodeURIComponent(i.ref)}`}>
                    {itemLabel(i)}
                  </Link>
                ) : (
                  <span className="muted">{itemLabel(i)}</span>
                )}
                <RemoveItem
                  listId={l.id}
                  creatorId={i.ref}
                  name={itemLabel(i)}
                />
              </div>
            ))
          ) : (
            <p className="empty">아직 담긴 크리에이터가 없습니다.</p>
          )}
          <ImportCsv listId={l.id} name={l.name} />
        </article>
      ))}
    </section>
  );
}
