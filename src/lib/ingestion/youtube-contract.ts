import { z } from "zod";
export const CHANNEL_ID = /^UC[A-Za-z0-9_-]{22}$/;
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
export type YouTubeErrorKind =
  "quota" | "rate" | "auth" | "bad_request" | "not_found" | "upstream";
export class YouTubeError extends Error {
  constructor(
    public kind: YouTubeErrorKind,
    message: string,
  ) {
    super(message);
  }
}
export const invalidYouTubeResponse = () =>
  new YouTubeError("upstream", "YouTube API 응답을 확인하지 못했습니다.");
const stats = z
  .object({ hiddenSubscriberCount: z.boolean().optional() })
  .catchall(z.unknown())
  .optional();
export const channelSchema = z.object({
  id: z.string().regex(CHANNEL_ID),
  snippet: z.object({
    title: z.string().min(1).max(500),
    description: z.string().max(10000).optional(),
    customUrl: z.string().max(200).optional(),
    publishedAt: z.iso.datetime({ offset: true }).optional(),
    country: z.string().max(8).optional(),
  }),
  statistics: stats,
  contentDetails: z
    .object({
      relatedPlaylists: z
        .object({
          uploads: z
            .string()
            .regex(/^[A-Za-z0-9_-]{1,128}$/)
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
export const playlistSchema = z.object({
  contentDetails: z.object({ videoId: z.string().regex(VIDEO_ID) }),
});
export const videoSchema = z.object({
  id: z.string().regex(VIDEO_ID),
  snippet: z.object({
    title: z.string().min(1).max(300),
    publishedAt: z.iso.datetime({ offset: true }),
    channelId: z.string().regex(CHANNEL_ID),
  }),
  status: z
    .object({ privacyStatus: z.enum(["public", "unlisted", "private"]) })
    .optional(),
  statistics: stats,
});
export function youtubeRows<T extends z.ZodType>(
  body: unknown,
  schema: T,
  limit: number,
): z.output<T>[] {
  const result = z
    .object({ items: z.array(schema).max(limit).default([]) })
    .safeParse(body);
  if (!result.success) throw invalidYouTubeResponse();
  return result.data.items;
}
export function attributedRows<T extends { id: string }>(
  items: T[],
  requested: readonly string[],
) {
  const ids = items.map((x) => x.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.some((id) => !requested.includes(id))
  )
    throw invalidYouTubeResponse();
  return items;
}
export function youtubeCount(v: unknown) {
  if (typeof v !== "string" || !/^\d{1,20}$/.test(v)) return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}
export async function readYouTubeJson(response: Response): Promise<unknown> {
  const max = 2 * 1024 * 1024,
    length = response.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > max) {
    void response.body?.cancel().catch(() => {});
    throw invalidYouTubeResponse();
  }
  if (!response.body) throw invalidYouTubeResponse();
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) {
        void reader.cancel().catch(() => {});
        throw invalidYouTubeResponse();
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}
