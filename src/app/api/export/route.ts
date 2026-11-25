import { apiRoute, fail, failDatabase, requireContext } from "@/lib/api";
import { provenance, toCsv } from "@/lib/csv";
import { isDemoMode } from "@/lib/mode";
import { inStage, isStage, pipelineCsv } from "@/lib/pipeline";
import { readSavedLists } from "@/lib/saved-lists";
import { readMySavedCreatorCatalog } from "@/lib/creator-catalog-read";
import { z } from "zod";
// Restored after merge a5f3326:
// - ?type=pipeline[&stage=] (D056) — RLS scopes rows to proposals the caller is a party to.
// - ?list=<uuid> (D038) — that owner-only group; default (♡) list otherwise. Rows come from the
//   public catalog DTO by public reference, so the file is re-importable and never carries
//   internal creator IDs; hidden/unknown creators are omitted.
const dto = z.object({
  seed_id: z.string(),
  name: z.string(),
  categories: z.array(z.string()),
  vibes: z.array(z.string()),
  price_min_krw: z.number().nullable(),
  is_demo: z.boolean(),
});
const csvResponse = (body: string, filename: string) =>
  new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
export const GET = apiRoute("export.get", async (req) => {
  const c = await requireContext();
  const params = new URL(req.url).searchParams;
  if (params.get("type") === "pipeline") {
    const stage = params.get("stage");
    if (stage && !isStage(stage)) fail("잘못된 요청입니다.");
    const { data: rows, error } = await c.db
      .from("proposals")
      .select("id,status,kind,brand_id,campaign_id,created_at")
      .or(`brand_id.eq.${c.user.id},creator_user_id.eq.${c.user.id}`)
      .order("created_at", { ascending: false });
    if (error) failDatabase(error, "내보내기에 실패했습니다.");
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
    return csvResponse(
      pipelineCsv(
        picked,
        c.user.id,
        new Map((camps ?? []).map((x) => [x.id, x.brief?.title ?? x.id])),
        events ?? [],
        deliverables,
      ),
      "adme-collaborations.csv",
    );
  }
  const listId = params.get("list");
  if (listId !== null && !z.uuid().safeParse(listId).success)
    fail("잘못된 요청입니다.");
  const people: z.infer<typeof dto>[] = [];
  let refs: string[] = [];
  if (!listId) {
    // Default (♡) list: the D005/D075 saved-catalog gateway already returns public DTOs.
    let saved;
    try {
      saved = await readMySavedCreatorCatalog(c.db);
    } catch {
      failDatabase({ code: "UNAVAILABLE" }, "내보내기에 실패했습니다.");
    }
    for (const row of saved) {
      const parsed = dto.safeParse({
        ...row.creator,
        seed_id: row.creator_id ?? "",
      });
      if (
        row.creator &&
        parsed.success &&
        (!parsed.data.is_demo || isDemoMode())
      )
        people.push(parsed.data);
    }
  } else {
    const lists = await readSavedLists(c.db);
    if (!lists)
      failDatabase({ code: "UNAVAILABLE" }, "내보내기에 실패했습니다.");
    const list = lists.find((l) => l.id === listId);
    // Another account's list is indistinguishable from a missing one.
    if (!list) fail("그룹을 찾을 수 없습니다.", 404);
    refs = list.items.filter((i) => i.visible).map((i) => i.ref);
  }
  for (let i = 0; i < refs.length; i += 25)
    for (const r of await Promise.all(
      refs
        .slice(i, i + 25)
        .map((ref) => c.db.rpc("creator_public_one", { p_ref: ref })),
    )) {
      const parsed = dto.safeParse(r.data);
      if (parsed.success && (!parsed.data.is_demo || isDemoMode()))
        people.push(parsed.data);
    }
  return csvResponse(
    toCsv([
      // ID + 출처 make the file re-importable (D038); 출처 근거 states the permission basis.
      ["ID", "이름", "분야", "분위기", "최소견적", "출처", "출처 근거"],
      ...people.map((p) => {
        const src = provenance(
          { is_demo: p.is_demo },
          p.is_demo ? null : "owner",
        );
        return [
          p.seed_id,
          p.name,
          p.categories.join(" / "),
          p.vibes.join(" / "),
          p.price_min_krw ?? "견적 미확인",
          src.label,
          src.basis,
        ];
      }),
    ]),
    "adme-shortlist.csv",
  );
});
