import {
  apiRoute,
  fail,
  failDatabase,
  parseBody,
  requireContext,
} from "@/lib/api";
import { competitorSchema } from "@/lib/ad-timeline";
export const POST = apiRoute("ad-history.competitors", async (req) => {
  const c = await requireContext();
  if (c.role !== "brand") fail("브랜드 계정의 개인 경쟁사 목록입니다.", 403);
  const labels = await parseBody(
    req,
    competitorSchema,
    "경쟁사 이름은 최대 20개까지 입력해주세요.",
  );
  const { data, error } = await c.db.rpc("set_ad_competitors", {
    p_labels: labels,
  });
  if (error) failDatabase(error, "경쟁사 목록을 저장하지 못했습니다.");
  const parsed = competitorSchema.safeParse(data);
  if (!parsed.success) fail("경쟁사 목록을 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
