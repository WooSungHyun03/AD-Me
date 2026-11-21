import { configured, supabase } from "@/lib/supabase";
import {
  adFilterSchema,
  adPageArgs,
  adPageSchema,
  competitorSchema,
} from "@/lib/ad-timeline";
import { AdTimeline } from "./ad-timeline";
export async function PublicAdHistory({ creatorId }: { creatorId: string }) {
  if (!configured()) return null;
  const db = await supabase(),
    { data, error } = await db.rpc(
      "ad_history_page",
      adPageArgs(adFilterSchema.parse({ creatorId })),
    );
  const page = adPageSchema.safeParse(data);
  if (error || !page.success)
    return <p className="notice">제출 광고 이력을 불러오지 못했습니다.</p>;
  const { data: role } = await db.rpc("my_role");
  let labels: string[] = [];
  if (role === "brand") {
    const own = await db.rpc("my_ad_competitors"),
      parsed = competitorSchema.safeParse(own.data);
    if (!own.error && parsed.success) labels = parsed.data;
  }
  return (
    <AdTimeline
      creatorId={creatorId}
      initial={page.data}
      canEdit={role === "brand"}
      initialLabels={labels}
    />
  );
}
