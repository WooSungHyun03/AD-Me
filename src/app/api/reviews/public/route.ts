import { z } from "zod";
import { apiRoute, fail, failDatabase, parseInput } from "@/lib/api";
import { configured, supabase } from "@/lib/supabase";
import { publicReviewSchema } from "@/lib/reviews";
export const GET = apiRoute("reviews.public", async (req) => {
  const q = parseInput(
    z.strictObject({ creatorId: z.string().min(1).max(100) }),
    Object.fromEntries(new URL(req.url).searchParams),
    "대상을 확인해주세요.",
  );
  if (!configured())
    return Response.json([], { headers: { "Cache-Control": "no-store" } });
  const db = await supabase(),
    { data, error } = await db.rpc("public_review_records", {
      p_creator: q.creatorId,
      p_kind: "issue",
    });
  if (error) failDatabase(error, "공개 검토 자료를 불러오지 못했습니다.");
  const parsed = z.array(publicReviewSchema).max(50).safeParse(data);
  if (!parsed.success) fail("공개 검토 응답을 확인하지 못했습니다.", 503);
  return Response.json(parsed.data, {
    headers: { "Cache-Control": "no-store" },
  });
});
