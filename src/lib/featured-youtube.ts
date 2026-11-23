import { z } from "zod";
import { youtubeImageHosts } from "./youtube-images";
import { configured, supabase } from "./supabase";

export const youtubeChannelId = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
const imageHosts = new Set(youtubeImageHosts);
const image = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:" &&
        imageHosts.has(url.host) &&
        !url.username &&
        !url.password
      )
        return url.href;
    } catch {}
    return undefined;
  });
const statistic = z.number().nonnegative().nullable().optional();
const timestamp = z
  .string()
  .refine((value) => Number.isFinite(Date.parse(value)));
const metadata = z.object({
  avatar: image,
  banner: image,
  handle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: timestamp.nullable().optional(),
  language: z.string().nullable().optional(),
  topics: z.array(z.string()).nullish(),
  views: statistic,
  videoCount: statistic,
});
const video = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
  title: z.string(),
  publishedAt: timestamp,
  views: statistic,
  likes: statistic,
  thumbnail: image,
});
const channel = z.object({
  channel_id: youtubeChannelId,
  creator_id: z.string().nullable().optional(),
  title: z.string(),
  subscriber_count: z.number().nullable(),
  fetched_at: timestamp,
  metadata: metadata.optional(),
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
  return value == null ? "비공개 또는 미제공" : youtubeMetric(value, "명");
}

export function youtubeMetric(value: number | null | undefined, unit: string) {
  return value == null ? "정보 없음" : count.format(value) + " " + unit;
}

export function isYoutubeDataStale(fetchedAt: string) {
  return Date.now() - Date.parse(fetchedAt) > 48 * 60 * 60 * 1000;
}
