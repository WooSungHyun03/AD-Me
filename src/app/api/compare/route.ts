import { NextResponse } from "next/server";
import { z } from "zod";
import { context, fail, safeOrigin } from "@/lib/api";
import { compareCsv, parseIds } from "@/lib/compare";
import { publicCreators } from "@/lib/data";
import { supabase } from "@/lib/supabase";
// D040: save a 2–3 person comparison with its share scope; CSV of a comparison (public fields only, no notes).
export async function POST(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({
      title: z.string().trim().min(1).max(80),
      ids: z.string(),
      share: z.enum(["private", "link"]),
    })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("제목과 공유 범위를 확인해주세요.");
  const ids = parseIds(p.data.ids);
  const known = new Set((await publicCreators()).map((x) => x.seed_id));
  if (ids.length < 2 || ids.some((x) => !known.has(x)))
    return fail("공개 프로필 2~3명을 골라주세요.");
  const { data, error } = await c.db
    .from("compare_reports")
    .insert({
      owner_id: c.user.id,
      title: p.data.title,
      creator_ids: ids,
      share: p.data.share,
    })
    .select("id,share_token")
    .single();
  if (error) return fail("비교를 저장하지 못했습니다.", 400);
  return NextResponse.json(data, { status: 201 });
}
export async function PATCH(req: Request) {
  if (!safeOrigin(req)) return fail("허용되지 않은 요청입니다.", 403);
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const p = z
    .object({ id: z.uuid(), share: z.enum(["private", "link"]) })
    .safeParse(await req.json().catch(() => null));
  if (!p.success) return fail("잘못된 요청입니다.");
  const { data } = await c.db
    .from("compare_reports")
    .update({ share: p.data.share })
    .eq("id", p.data.id)
    .select("share_token");
  if (!data?.length) return fail("비교를 찾을 수 없습니다.", 404);
  return NextResponse.json({ ok: true, share_token: data[0].share_token });
}
export async function GET(req: Request) {
  const u = new URL(req.url);
  let ids = parseIds(u.searchParams.get("ids"));
  const token = u.searchParams.get("share");
  if (token) {
    const { data } = await (
      await supabase()
    ).rpc("shared_compare", { p_token: token });
    ids = data?.[0]?.creator_ids ?? [];
  }
  const all = await publicCreators();
  const people = ids
    .map((id) => all.find((x) => x.seed_id === id))
    .filter((x) => !!x);
  if (!people.length) return fail("비교할 공개 프로필이 없습니다.", 404);
  return new Response(compareCsv(people), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="adme-compare.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
