import { context, fail } from "@/lib/api";
import { provenance, toCsv } from "@/lib/csv";
import { isDemoMode } from "@/lib/mode";
import { inStage, isStage, pipelineCsv } from "@/lib/pipeline";
// ?list=<uuid> exports that group (RLS limits it to the caller's own); default list otherwise.
export async function GET(req: Request) {
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const params = new URL(req.url).searchParams;
  // D056: collaboration results — RLS scopes rows to proposals the caller is a party to.
  if (params.get("type") === "pipeline") {
    const stage = params.get("stage");
    if (stage && !isStage(stage)) return fail("잘못된 요청입니다.");
    const { data: rows, error } = await c.db
      .from("proposals")
      .select("id,status,kind,brand_id,campaign_id,created_at")
      .or(`brand_id.eq.${c.user.id},creator_user_id.eq.${c.user.id}`)
      .order("created_at", { ascending: false });
    if (error) return fail("내보내기에 실패했습니다.", 500);
    const picked = inStage(rows ?? [], isStage(stage) ? stage : undefined);
    const ids = picked.map((p) => p.id);
    const [{ data: camps }, { data: events }, { data: files }] =
      await Promise.all([
        c.db
          .from("campaigns")
          .select("id,brief")
          .in("id", [...new Set(picked.map((p) => p.campaign_id))]),
        c.db
          .from("proposal_events")
          .select("proposal_id,to_status,created_at")
          .in("proposal_id", ids)
          .order("id"),
        c.db
          .from("messages")
          .select("proposal_id")
          .eq("kind", "deliverable")
          .in("proposal_id", ids),
      ]);
    const deliverables = new Map<string, number>();
    for (const m of files ?? [])
      deliverables.set(
        m.proposal_id,
        (deliverables.get(m.proposal_id) ?? 0) + 1,
      );
    return new Response(
      pipelineCsv(
        picked,
        c.user.id,
        new Map((camps ?? []).map((x) => [x.id, x.brief?.title ?? x.id])),
        events ?? [],
        deliverables,
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="adme-collaborations.csv"',
          "Cache-Control": "private, no-store",
        },
      },
    );
  }
  const list = params.get("list");
  if (list && !/^[0-9a-f-]{36}$/.test(list)) return fail("잘못된 요청입니다.");
  let items = c.db
    .from("saved_list_items")
    .select("creator_id,saved_lists!inner(is_default)")
    .eq("owner_id", c.user.id);
  items = list
    ? items.eq("list_id", list)
    : items.eq("saved_lists.is_default", true);
  const { data, error } = await items;
  if (error) return fail("내보내기에 실패했습니다.", 500);
  const ids = data?.map((x) => x.creator_id) ?? [];
  let q = c.db.from("creators").select("id,profile,owner_id").in("id", ids);
  if (!isDemoMode()) q = q.eq("profile->>is_demo", "false");
  const { data: people } = await q;
  return new Response(
    toCsv([
      // ID + 출처 make the file re-importable (D038); 출처 근거 states the permission basis.
      ["ID", "이름", "분야", "분위기", "최소견적", "출처", "출처 근거"],
      ...(people ?? []).map((c) => {
        const src = provenance(c.profile, c.owner_id);
        return [
          c.id,
          c.profile.name,
          c.profile.categories.join(" / "),
          c.profile.vibes.join(" / "),
          c.profile.price_min_krw ?? "미확인",
          src.label,
          src.basis,
        ];
      }),
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="adme-shortlist.csv"',
        "Cache-Control": "private, no-store",
      },
    },
  );
}
