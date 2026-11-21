import { apiRoute, fail, failDatabase, parseInput } from "@/lib/api";
import {
  adFilterSchema,
  adCursorSchema,
  adPageArgs,
  adPageSchema,
} from "@/lib/ad-timeline";
import { configured, supabase } from "@/lib/supabase";
export const GET = apiRoute("ad-history.search", async (req) => {
  const q = new URL(req.url).searchParams,
    input = Object.fromEntries(q);
  delete input.cursor;
  const filters = parseInput(
    adFilterSchema,
    input,
    "광고 이력 검색 조건을 확인해주세요.",
  );
  let cursor = null;
  if (q.has("cursor")) {
    const text = q.get("cursor")!;
    if (text.length > 1500) fail("다음 페이지 조건을 확인해주세요.", 422);
    try {
      cursor = adCursorSchema.parse(JSON.parse(text));
    } catch {
      fail("다음 페이지 조건을 확인해주세요.", 422);
    }
  }
  if (!configured())
    return Response.json(
      { version: 1, items: [], total: 0, nextCursor: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  const db = await supabase(),
    { data, error } = await db.rpc(
      "ad_history_page",
      adPageArgs(filters, cursor),
    );
  if (error) failDatabase(error, "광고 이력을 불러오지 못했습니다.");
  const page = adPageSchema.safeParse(data);
  if (!page.success) fail("광고 이력 응답을 확인하지 못했습니다.", 503);
  return Response.json(page.data, {
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
});
