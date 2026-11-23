import { apiRoute, fail, failDatabase } from "@/lib/api";
import { configured, supabase } from "@/lib/supabase";
import { reserveRequestBudget } from "@/lib/request-budget";
import {
  parseYoutubeDirectory,
  youtubeDirectoryKeys,
  youtubeDirectoryPage,
} from "@/lib/youtube-directory";

export const GET = apiRoute("creators.youtube", async (req) => {
  const params = new URL(req.url).searchParams;
  if ([...params.keys()].some((key) => !youtubeDirectoryKeys.includes(key)))
    fail("검색 항목을 확인해주세요.", 422);
  let input;
  try {
    input = parseYoutubeDirectory(params);
  } catch {
    fail("검색 조건을 확인해주세요.", 422);
  }
  if (!configured()) fail("검색 연결을 준비 중입니다.", 503);
  const budget = await reserveRequestBudget("search");
  if (budget) fail(budget, budget.startsWith("요청이 많습니다") ? 429 : 503);
  const { data, error } = await (
    await supabase()
  ).rpc("youtube_directory_page", {
    p_filters: input.filters,
    p_cursor: input.cursor,
    p_limit: 24,
  });
  if (error) failDatabase(error, "공개 채널을 불러오지 못했습니다.");
  const parsed = youtubeDirectoryPage.safeParse(data);
  if (!parsed.success) fail("공개 채널을 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
