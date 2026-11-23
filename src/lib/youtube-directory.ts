import { z } from "zod";
import { featuredChannelSchema } from "./featured-youtube";
import { publicTopicOptions } from "./public-youtube-topics";

export const youtubeDirectoryKeys = [
  "q",
  "yt-topic",
  "subscribers",
  "yt-sort",
  "yt-cursor",
];
export const youtubeDirectoryFilters = z.strictObject({
  query: z.string().trim().max(80),
  topic: z
    .string()
    .refine((value) => !value || Object.hasOwn(publicTopicOptions, value)),
  subscribers: z.enum(["", "under-100k", "100k-1m", "over-1m"]),
  sort: z.enum(["subscribers", "updated", "name"]),
});
export function parseYoutubeDirectory(params: URLSearchParams) {
  for (const key of youtubeDirectoryKeys)
    if (params.getAll(key).length > 1) throw Error("검색 조건을 확인해주세요.");
  const filters = youtubeDirectoryFilters.parse({
    query: params.get("q") ?? "",
    topic: params.get("yt-topic") ?? "",
    subscribers: params.get("subscribers") ?? "",
    sort: params.get("yt-sort") || "subscribers",
  });
  const cursor = z
    .string()
    .min(1)
    .max(1500)
    .nullable()
    .parse(params.get("yt-cursor"));
  return { filters, cursor };
}
export const youtubeDirectoryPage = z.strictObject({
  version: z.literal(1),
  items: z.array(featuredChannelSchema).max(50),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().min(1).max(1500).nullable(),
});
export type YoutubeDirectoryPage = z.infer<typeof youtubeDirectoryPage>;
export async function readYoutubeDirectory(
  db: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  params: URLSearchParams,
): Promise<YoutubeDirectoryPage> {
  const { filters, cursor } = parseYoutubeDirectory(params);
  const { data, error } = await db.rpc("youtube_directory_page", {
    p_filters: filters,
    p_cursor: cursor,
    p_limit: 24,
  });
  const parsed = youtubeDirectoryPage.safeParse(data);
  if (error || !parsed.success) throw Error("공개 채널을 불러오지 못했습니다.");
  return parsed.data;
}
