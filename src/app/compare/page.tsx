import Link from "next/link";
import { publicCreator } from "@/lib/data";
import { COMPARE_ROWS, parseIds } from "@/lib/compare";
import { currentUser, supabase } from "@/lib/supabase";
import { NoteEditor, SaveCompare, ShareToggle } from "@/components/compare";
// D040 (restored after merge a5f3326): private notes, saved comparisons and link sharing.
export default async function Compare({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string; share?: string }>;
}) {
  const p = await searchParams;
  const db = await supabase();
  // A shared link resolves to title + ids only; it never carries notes, the owner or campaign data.
  let ids = parseIds(p.ids);
  let sharedTitle: string | null = null;
  if (p.share) {
    const { data } = await db.rpc("shared_compare", { p_token: p.share });
    sharedTitle = data?.[0]?.title ?? null;
    ids = data?.[0]?.creator_ids ?? [];
  }
  // Each reference resolves through the public catalog DTO (unknown/hidden → dropped).
  const list = (await Promise.all(ids.map((id) => publicCreator(id)))).filter(
    (c) => c !== null,
  );
  const user = p.share ? null : await currentUser();
  const [{ data: notes }, { data: saved }] = user
    ? await Promise.all([
        db
          .from("creator_notes")
          .select("creator_id,body")
          .in("creator_id", ids.length ? ids : ["-"]),
        db
          .from("compare_reports")
          .select("id,title,creator_ids,share,share_token")
          .order("created_at", { ascending: false })
          .limit(20),
      ])
    : [{ data: [] }, { data: [] }];
  const note = (id: string) =>
    notes?.find((n) => n.creator_id === id)?.body ?? "";
  const csvHref = p.share
    ? `/api/compare?share=${encodeURIComponent(p.share)}`
    : `/api/compare?ids=${ids.join(",")}`;
  return (
    <section className="wrap">
      <span className="eyebrow">Side by side</span>
      <h1 className="page-title">
        {sharedTitle ?? "감각은 나란히, 결정은 명확히."}
      </h1>
      {p.share ? (
        <p className="notice" role="note">
          공유된 비교입니다. 공개 프로필 정보만 보이며, 작성자의 비공개 메모와
          캠페인 정보는 포함되지 않습니다.
        </p>
      ) : (
        <p>
          2~3명의 공개 프로필을 비교합니다. 값, 출처·근거, 기준 시점을 구분하고
          비어 있는 값은 결측으로 표시합니다.
        </p>
      )}
      {p.share && !list.length && (
        <div className="empty">공유가 꺼졌거나 없는 링크입니다.</div>
      )}
      {list.length ? (
        <>
          <div className="table-scroll">
            <table className="data-table" data-testid="compare-table">
              <thead>
                <tr>
                  <th>비교 항목</th>
                  {list.map((c) => (
                    <th key={c.seed_id}>
                      <Link href={`/creators/${c.seed_id}`}>{c.name} ↗</Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map(([label, fn]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {list.map((c) => {
                      const v = fn(c);
                      return (
                        <td
                          key={c.seed_id}
                          style={
                            v.missing ? { color: "var(--muted)" } : undefined
                          }
                        >
                          {v.missing && <span className="badge">결측</span>}{" "}
                          {v.text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <a
            className="button outline small"
            href={csvHref}
            style={{ marginTop: 16 }}
          >
            비교 CSV (메모 제외)
          </a>
        </>
      ) : (
        !p.share && (
          <div className="empty">
            탐색 화면에서 비교할 후보를 2~3명 선택해주세요.
          </div>
        )
      )}
      {user && list.length > 0 && (
        <>
          <h2 style={{ marginTop: 40 }}>내 비공개 메모</h2>
          <p style={{ fontSize: 13 }}>
            나만 볼 수 있습니다. 제안 메시지나 공유 링크에 포함되지 않습니다.
          </p>
          <div data-testid="private-notes">
            {list.map((c) => (
              <NoteEditor
                key={c.seed_id}
                creatorId={c.seed_id}
                name={c.name}
                body={note(c.seed_id)}
              />
            ))}
          </div>
          {list.length >= 2 && (
            <>
              <h2 style={{ marginTop: 40 }}>이 비교 저장</h2>
              <SaveCompare ids={ids.join(",")} />
            </>
          )}
        </>
      )}
      {user && !!saved?.length && (
        <>
          <h2 style={{ marginTop: 40 }}>저장한 비교</h2>
          {saved.map((s) => (
            <div
              className="inline"
              key={s.id}
              data-testid="saved-compare"
              style={{ borderTop: "1px solid var(--line)", padding: "12px 0" }}
            >
              <Link href={`/compare?ids=${s.creator_ids.join(",")}`}>
                {s.title}
              </Link>
              <span style={{ fontSize: 12 }}>
                {s.share === "link" ? (
                  <Link href={`/compare?share=${s.share_token}`}>
                    공유 링크
                  </Link>
                ) : (
                  "나만 보기"
                )}
              </span>
              <ShareToggle id={s.id} shared={s.share === "link"} />
            </div>
          ))}
        </>
      )}
      <Link
        className="button outline"
        style={{ marginTop: 24 }}
        href="/creators"
      >
        탐색으로 돌아가기
      </Link>
    </section>
  );
}
