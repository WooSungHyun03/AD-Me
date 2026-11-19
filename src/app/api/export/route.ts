import { context, fail } from "@/lib/api";
import { toCsv } from "@/lib/csv";
export async function GET() {
  const c = await context();
  if (!c) return fail("로그인이 필요합니다.", 401);
  const { data, error } = await c.db
    .from("saved_creators")
    .select("creator_id,creators(profile)")
    .eq("owner_id", c.user.id);
  if (error) return fail("내보내기에 실패했습니다.", 500);
  const ids = data?.map((x) => x.creator_id) ?? [];
  const { data: people } = await c.db
    .from("creators")
    .select("id,profile")
    .in("id", ids);
  return new Response(
    toCsv([
      ["이름", "분야", "분위기", "최소견적", "출처"],
      ...(people ?? []).map((c) => [
        c.profile.name,
        c.profile.categories.join(" / "),
        c.profile.vibes.join(" / "),
        c.profile.price_min_krw,
        c.profile.is_demo ? "DEMO" : "본인 등록",
      ]),
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
