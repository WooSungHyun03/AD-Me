import {
  assertSourceAllowed,
  pickAllowed,
  policies,
  type SourcePolicy,
} from "./policy";
// Low-cost endpoints only (1 quota unit each): channels.list, playlistItems.list, videos.list.
// search.list (100 units) is deliberately not used; input is an allowlisted channel-ID seed.
const API = "https://www.googleapis.com/youtube/v3";
export { YouTubeError, type YouTubeErrorKind } from "./youtube-contract";
import {
  YouTubeError,
  CHANNEL_ID,
  channelSchema,
  playlistSchema,
  videoSchema,
  attributedRows,
  youtubeRows,
  youtubeCount as num,
  readYouTubeJson,
  invalidYouTubeResponse,
} from "./youtube-contract";
import { z } from "zod";
type Fetch = typeof fetch;
type Opts = {
  apiKey?: string;
  fetchImpl?: Fetch;
  policyTable?: Record<string, SourcePolicy>;
  maxVideos?: number;
};
async function call(
  path: string,
  params: Record<string, string>,
  key: string,
  f: Fetch,
) {
  const url = new URL(`${API}/${path}`);
  Object.entries({ ...params, key }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  );
  try {
    const res = await f(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      redirect: "error",
    });
    // These statuses do not need a provider body (which may be HTML or contain credentials).
    if ([400, 401, 404, 429].includes(res.status) || res.status >= 500) {
      void res.body?.cancel().catch(() => {});
      if (res.status === 429)
        throw new YouTubeError("rate", "YouTube API 속도 제한");
      if (res.status === 401)
        throw new YouTubeError("auth", "YouTube API 키 권한 오류");
      if (res.status === 404)
        throw new YouTubeError("not_found", "YouTube 자료를 찾을 수 없습니다.");
      if (res.status === 400)
        throw new YouTubeError("bad_request", "잘못된 YouTube API 요청");
      throw invalidYouTubeResponse();
    }
    const body = await readYouTubeJson(res);
    if (res.ok) return body;
    const parsed = z
      .object({
        error: z.object({ errors: z.array(z.object({ reason: z.string() })) }),
      })
      .safeParse(body);
    const reason = parsed.success
      ? (parsed.data.error.errors[0]?.reason ?? "")
      : "";
    if (["quotaExceeded", "dailyLimitExceeded"].includes(reason))
      throw new YouTubeError("quota", "YouTube API 일일 할당량 초과");
    if (
      res.status === 429 ||
      ["rateLimitExceeded", "userRateLimitExceeded"].includes(reason)
    )
      throw new YouTubeError("rate", "YouTube API 속도 제한");
    if (res.status === 401 || res.status === 403)
      throw new YouTubeError("auth", "YouTube API 키 권한 오류");
    if (res.status === 404)
      throw new YouTubeError("not_found", "YouTube 자료를 찾을 수 없습니다.");
    if (res.status === 400)
      throw new YouTubeError("bad_request", "잘못된 YouTube API 요청");
    throw invalidYouTubeResponse();
  } catch (error) {
    if (error instanceof YouTubeError) throw error;
    throw invalidYouTubeResponse();
  }
}

export type ChannelResult =
  | { channel_id: string; status: "not_found" } // deleted, terminated or wrong ID: API does not distinguish
  | {
      channel_id: string;
      status: "ok";
      source_type: "youtube_data_api";
      source_url: string;
      fetched_at: string;
      profile: Record<string, unknown>;
      videos: Record<string, unknown>[];
    };

export async function fetchChannels(
  seed: string[],
  opts: Opts = {},
): Promise<ChannelResult[]> {
  // Policy gate before any network call or key lookup.
  const policy = assertSourceAllowed(
    "youtube_data_api",
    new Date(),
    opts.policyTable ?? policies,
  );
  const max = opts.maxVideos ?? 5;
  if (
    !Array.isArray(seed) ||
    seed.length > 25 ||
    seed.some((id) => typeof id !== "string" || !CHANNEL_ID.test(id)) ||
    !Number.isInteger(max) ||
    max < 0 ||
    max > 50
  )
    throw new YouTubeError(
      "bad_request",
      "채널 입력 또는 영상 한도를 확인해주세요.",
    );
  const ids = [...new Set(seed)];
  if (!ids.length) return [];
  const key = opts.apiKey ?? process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("auth", "YOUTUBE_API_KEY 미설정");
  const f = opts.fetchImpl ?? fetch;
  const out: ChannelResult[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await call(
      "channels",
      {
        part: "snippet,statistics,contentDetails",
        id: batch.join(","),
        maxResults: "50",
      },
      key,
      f,
    ).catch((error) => {
      if (error instanceof YouTubeError && error.kind === "not_found")
        return { items: [] };
      throw error;
    });
    const byId = new Map(
      attributedRows(youtubeRows(data, channelSchema, batch.length), batch).map(
        (c) => [c.id, c],
      ),
    );
    for (const id of batch) {
      const c = byId.get(id);
      if (!c) {
        out.push({ channel_id: id, status: "not_found" });
        continue;
      }
      const hidden = c.statistics?.hiddenSubscriberCount === true;
      const profile = pickAllowed(policy, {
        channel_id: id,
        title: c.snippet?.title ?? null,
        description: c.snippet?.description ?? null,
        custom_url: c.snippet?.customUrl ?? null,
        published_at: c.snippet?.publishedAt ?? null,
        country: c.snippet?.country ?? null,
        // Hidden counts stay null: never estimated or back-filled.
        subscriber_count: hidden ? null : num(c.statistics?.subscriberCount),
        hidden_subscriber_count: hidden,
        video_count: num(c.statistics?.videoCount),
        view_count: num(c.statistics?.viewCount),
      });
      const uploads = c.contentDetails?.relatedPlaylists?.uploads;
      const videos =
        uploads && max > 0
          ? await recentVideos(id, uploads, key, f, policy, max)
          : [];
      out.push({
        channel_id: id,
        status: "ok",
        source_type: "youtube_data_api",
        source_url: `https://www.youtube.com/channel/${id}`,
        fetched_at: new Date().toISOString(),
        profile,
        videos,
      });
    }
  }
  return out;
}

async function recentVideos(
  owner: string,
  playlist: string,
  key: string,
  f: Fetch,
  policy: SourcePolicy,
  max: number,
) {
  const list = await call(
    "playlistItems",
    {
      part: "contentDetails",
      playlistId: playlist,
      maxResults: String(Math.min(max, 50)),
    },
    key,
    f,
  ).catch((e) => {
    if (e instanceof YouTubeError && e.kind === "not_found")
      return { items: [] };
    throw e;
  });
  const ids = [
    ...new Set(
      youtubeRows(list, playlistSchema, max).map(
        (x) => x.contentDetails.videoId,
      ),
    ),
  ];
  if (!ids.length) return [];
  const v = await call(
    "videos",
    { part: "snippet,status,statistics", id: ids.join(",") },
    key,
    f,
  ).catch((error) => {
    if (error instanceof YouTubeError && error.kind === "not_found")
      return { items: [] };
    throw error;
  });
  return attributedRows(youtubeRows(v, videoSchema, ids.length), ids)
    .filter((x) => x.status?.privacyStatus === "public")
    .map((x) => {
      if (x.snippet.channelId !== owner) throw invalidYouTubeResponse();
      return pickAllowed(policy, {
        video_id: x.id,
        video_title: x.snippet?.title ?? null,
        video_published_at: x.snippet?.publishedAt ?? null,
        video_view_count: num(x.statistics?.viewCount),
        // likeCount/commentCount are absent when hidden or disabled → null, not 0.
        video_like_count: num(x.statistics?.likeCount),
        video_comment_count: num(x.statistics?.commentCount),
      });
    });
}
