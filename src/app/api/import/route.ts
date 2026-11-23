import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import {
  IMPORT_LIMITS,
  provenance,
  readImport,
  toCsv,
  type ImportRow,
} from "@/lib/csv";
import { isDemoMode } from "@/lib/mode";
// D038: shortlist CSV import in two steps. "preview" validates and writes nothing; "commit" re-validates the
// same file on the server and inserts only valid rows. Rows never trigger external fetches.
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      action: z.enum(["preview", "commit"]),
      listId: z.uuid(),
      csv: z.string().max(IMPORT_LIMITS.bytes * 2),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  // RLS: only the caller's own lists are visible; another account's list is "not found".
  const { data: list } = await c.db
    .from("saved_lists")
    .select("id")
    .eq("id", p.data.listId)
    .maybeSingle();
  if (!list) return fail("그룹을 찾을 수 없습니다.", 404);
  const parsed = readImport(p.data.csv);
  if ("error" in parsed) return fail(parsed.error, 422);
  const ids = parsed.rows.filter((r) => !r.error).map((r) => r.id);
  let q = c.db
    .from("creators")
    .select("id,profile,owner_id")
    .eq("published", true)
    .in("id", ids.length ? ids : ["-"]);
  if (!isDemoMode()) q = q.eq("profile->>is_demo", "false");
  const [{ data: people }, { data: existing }] = await Promise.all([
    q,
    c.db.from("saved_list_items").select("creator_id").eq("list_id", list.id),
  ]);
  const byId = new Map((people ?? []).map((x) => [x.id, x]));
  const inList = new Set((existing ?? []).map((x) => x.creator_id));
  const rows: ImportRow[] = parsed.rows.map((r) => {
    if (r.error)
      return { line: r.line, id: r.id, status: "error", message: r.error };
    const person = byId.get(r.id);
    if (!person)
      return {
        line: r.line,
        id: r.id,
        status: "error",
        message: "공개된 AD Me 프로필이 아닙니다.",
      };
    const actual = provenance(person.profile, person.owner_id).label;
    if (actual !== r.source)
      return {
        line: r.line,
        id: r.id,
        status: "error",
        message: `출처가 다릅니다(실제: ${actual}).`,
      };
    if (inList.has(r.id))
      return {
        line: r.line,
        id: r.id,
        status: "exists",
        message: "이미 그룹에 있습니다.",
      };
    return { line: r.line, id: r.id, status: "ok" };
  });
  const ok = rows.filter((r) => r.status === "ok");
  if (p.data.action === "commit" && ok.length) {
    const { error } = await c.db.from("saved_list_items").upsert(
      ok.map((r) => ({
        list_id: list.id,
        creator_id: r.id,
        owner_id: c.user.id,
      })),
      { onConflict: "list_id,creator_id", ignoreDuplicates: true },
    );
    if (error)
      return fail(
        "가져오기를 저장하지 못했습니다. 아무 행도 추가되지 않았습니다.",
        403,
      );
  }
  return NextResponse.json({
    committed: p.data.action === "commit",
    summary: {
      ok: ok.length,
      exists: rows.filter((r) => r.status === "exists").length,
      error: rows.filter((r) => r.status === "error").length,
    },
    rows,
  });
}
// Template: the export's columns; only ID and 출처 are read back.
export function GET() {
  return new Response(
    toCsv([
      ["ID", "이름", "출처", "메모(가져오지 않음)"],
      ["creator-001", "서하린(예시)", "DEMO", "예시 행은 지우고 사용하세요"],
    ]),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="adme-import-template.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
