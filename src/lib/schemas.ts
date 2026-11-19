import { z } from "zod";
export const campaignSchema = z.object({
  title: z.string().trim().min(2).max(120),
  product: z.string().trim().min(1).max(120),
  category: z.string().min(1).max(50),
  vibes: z.array(z.string().max(30)).min(1).max(8),
  format: z.string().min(1).max(40),
  platforms: z.array(z.enum(["instagram", "youtube", "tiktok"])).min(1),
  budget_krw: z.number().int().min(10000).max(100000000),
  target_audience: z.string().min(2).max(500),
  goal: z.string().min(2).max(500),
  status: z.enum(["draft", "published", "closed"]),
});
export const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    bio: z.string().max(1000),
    categories: z.array(z.string().max(50)).min(1).max(5),
    vibes: z.array(z.string().max(30)).min(1).max(8),
    formats: z.array(z.string().max(40)).min(1).max(8),
    platforms: z.array(z.enum(["instagram", "youtube", "tiktok"])).min(1),
    price_min_krw: z.number().int().min(0).max(100000000),
    price_max_krw: z.number().int().min(0).max(100000000),
    is_available: z.boolean(),
    published: z.boolean(),
  })
  .refine((d) => d.price_max_krw >= d.price_min_krw, {
    message: "최대 견적은 최소 견적 이상이어야 합니다.",
  });
export const proposalSchema = z.object({
  campaignId: z.uuid(),
  creatorId: z.string().min(1).max(100),
  brief: z.string().trim().min(10).max(3000),
  kind: z.enum(["proposal", "application"]),
});
export function canTransition(
  kind: string,
  state: string,
  action: string,
  role: string,
) {
  const start = kind === "application" ? "brand" : "creator";
  return (
    (state === "pending" &&
      ["accepted", "rejected"].includes(action) &&
      role === start) ||
    (state === "accepted" && action === "submitted" && role === "creator") ||
    (state === "submitted" &&
      ["completed", "revision_requested"].includes(action) &&
      role === "brand") ||
    (state === "revision_requested" &&
      action === "submitted" &&
      role === "creator")
  );
}
