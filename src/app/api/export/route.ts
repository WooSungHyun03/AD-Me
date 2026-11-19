import { apiRoute, failDatabase, requireContext } from "@/lib/api";
import { toCsv } from "@/lib/csv";
export const GET = apiRoute("export.get", async () => {
  const c = await requireContext();
  const { data, error } = await c.db
    .from("saved_creators")
    .select("creator_id")
    .eq("owner_id", c.user.id);
  if (error) failDatabase(error, "내보내기에 실패했습니다.");
  const ids = data?.map((x) => x.creator_id) ?? [];
  const result = ids.length
    ? await c.db.from("creators").select("id,profile").in("id", ids)
    : null;
  if (result?.error) failDatabase(result.error, "내보내기에 실패했습니다.");
  return new Response(
    toCsv([
      ["이름", "분야", "분위기", "최소견적", "출처"],
      ...(result?.data ?? []).map((c) => [
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
});
