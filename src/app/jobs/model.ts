import { z } from "zod";

export const jobsSchema = z.array(
  z.object({
    id: z.uuid(),
    brief: z.object({
      title: z.string(),
      product: z.string(),
      category: z.string(),
      format: z.string(),
      budget_krw: z.number(),
      goal: z.string(),
      target_audience: z.string(),
    }),
    status: z.enum(["draft", "published", "closed"]),
    expires_at: z.string().nullable(),
    owned: z.boolean(),
    applied: z.boolean(),
  }),
);

export function jobExpiry(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
  }).format(new Date(value));
}
