import { z } from "zod";
import { configured, supabase } from "./supabase";

const video = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string(),
  publishedAt: z.string(),
  views: z.number().nullable().optional(),
});
const channel = z.object({
  channel_id: z.string().regex(/^UC[A-Za-z0-9_-]{22}$/),
  title: z.string(),
  subscriber_count: z.number().nullable(),
  fetched_at: z.string(),
  videos: z.array(video),
});
export type FeaturedChannel = z.infer<typeof channel>;

export async function featuredYoutube(
  query = "",
  id: string | null = null,
  limit = 24,
) {
  if (!configured()) return { items: [], unavailable: true };
  const { data, error } = await (
    await supabase()
  ).rpc("featured_youtube", {
    p_query: query,
    p_id: id,
    p_limit: limit,
  });
  const parsed = z.array(channel).safeParse(data);
  return {
    items: !error && parsed.success ? parsed.data : [],
    unavailable: !!error || !parsed.success,
  };
}

const count = new Intl.NumberFormat("ko-KR", {
  notation: "compact",
  maximumFractionDigits: 1,
});
export function youtubeCount(value: number | null | undefined) {
  return value == null ? "비공개" : count.format(value) + "명";
}
