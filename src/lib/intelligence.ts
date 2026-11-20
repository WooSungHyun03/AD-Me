import { z } from "zod";

export const roles = [
  "super",
  "content",
  "campaign",
  "finance",
  "support",
] as const;
export const channelId = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
export function parseChannel(value: string): string | null {
  const input = value.trim();
  if (channelId.safeParse(input).success) return input;
  try {
    const url = new URL(input);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.port ||
      !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(
        url.hostname,
      )
    )
      return null;
    const match = /^\/channel\/(UC[A-Za-z0-9_-]{22})\/?$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
export const opsCommand = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("channel"),
    value: z
      .string()
      .max(240)
      .transform((input) => parseChannel(input) ?? "")
      .pipe(channelId),
  }),
  z.object({
    action: z.literal("review"),
    value: channelId,
    extra: z.enum(["accepted", "rejected", "pending"]),
  }),
  z.object({
    action: z.literal("discovery"),
    value: z.string().trim().min(2).max(80),
    extra: z.enum(["true", "false"]),
  }),
  z.object({
    action: z.literal("staff"),
    value: z.uuid(),
    extra: z.enum([...roles, "remove"]),
  }),
]);
export const draftInput = z.string().trim().min(10).max(1600);
export const draftResult = z.object({
  concept: z.string().min(1).max(600),
  outline: z.array(z.string().min(1).max(320)).min(1).max(6),
  proposal: z.string().min(1).max(900),
  model: z.string().max(100),
});
