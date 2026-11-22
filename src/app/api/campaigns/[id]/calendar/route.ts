import { z } from "zod";
import { apiRoute, fail, failDatabase, requireContext } from "@/lib/api";
import { campaignCalendar } from "@/lib/campaign-calendar";
export const GET = apiRoute("campaign.calendar", async (req) => {
  const c = await requireContext();
  if (c.role !== "brand") fail("캠페인 소유자 권한이 필요합니다.", 403);
  const id = new URL(req.url).pathname.split("/").at(-2);
  if (!z.uuid().safeParse(id).success) fail("캠페인을 찾을 수 없습니다.", 404);
  const { data, error } = await c.db
    .from("campaigns")
    .select("brief,is_demo")
    .eq("id", id!)
    .eq("owner_id", c.user.id)
    .maybeSingle();
  if (error) failDatabase(error, "일정을 불러오지 못했습니다.");
  if (!data || data.is_demo) fail("캠페인을 찾을 수 없습니다.", 404);
  if (!data.brief.terms) fail("구조화된 캠페인 일정이 필요합니다.", 409);
  return new Response(
    campaignCalendar({
      id: id!,
      title: data.brief.title,
      terms: data.brief.terms,
    }),
    {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="campaign-calendar.ics"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
});
