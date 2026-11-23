import { apiRoute, failDatabase, requireContext } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { readMySavedCreatorCatalog } from "@/lib/creator-catalog-read";
export const GET = apiRoute("export.get", async () => {
  const c = await requireContext();
  let saved;
  try {
    saved = await readMySavedCreatorCatalog(c.db);
  } catch {
    failDatabase({ code: "UNAVAILABLE" }, "내보내기에 실패했습니다.");
  }
  return new Response(
    toCsv([
      ["이름", "분야", "분위기", "최소견적", "출처"],
      ...saved.flatMap(({ creator }) =>
        creator
          ? [
              [
                creator.name,
                creator.categories.join(" / "),
                creator.vibes.join(" / "),
                creator.price_min_krw,
                creator.is_demo ? "DEMO" : "본인 등록",
              ],
            ]
          : [],
      ),
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
