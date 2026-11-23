import { apiRoute, fail, failDatabase } from "@/lib/api";
import { configured, supabase } from "@/lib/supabase";
import { getConfig } from "@/lib/config";
import { reserveRequestBudget } from "@/lib/request-budget";
import { creatorFilterKeys, parseCreatorFilters } from "@/lib/creator-filters";
import {
  creatorFilterSchema,
  filteredCatalogSchema,
} from "@/lib/filtered-catalog";
export const GET = apiRoute("creators.search", async (req) => {
  if (!configured()) fail("검색 연결을 준비 중입니다.", 503);
  const budget = await reserveRequestBudget("search");
  if (budget) fail(budget, budget.startsWith("요청이 많습니다") ? 429 : 503);
  const q = new URL(req.url).searchParams;
  for (const key of q.keys())
    if (![...creatorFilterKeys, "cursor"].includes(key))
      fail("검색 항목을 확인해주세요.", 422);
  const f = creatorFilterSchema.safeParse(parseCreatorFilters(q));
  if (!f.success || (q.get("cursor")?.length ?? 0) > 1500)
    fail("검색 조건을 확인해주세요.", 422);
  const db = await supabase(),
    { data, error } = await db.rpc("creator_filter_page", {
      p_filters: f.data,
      p_cursor: q.get("cursor"),
      p_limit: 24,
      p_demo: getConfig().serviceMode === "test_demo",
    });
  if (error) failDatabase(error, "검색 결과를 불러오지 못했습니다.");
  const page = filteredCatalogSchema.safeParse(data);
  if (!page.success) fail("검색 결과를 확인하지 못했습니다.", 503);
  return Response.json(page.data, { headers: { "Cache-Control": "no-store" } });
});
