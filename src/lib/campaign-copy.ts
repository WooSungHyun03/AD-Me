import { campaignSchema } from "./schemas";

// Copy business brief fields only. Relational children and upload references never enter this projection.
export function copyCampaignBrief(
  source: { ownerId: string; isDemo: boolean; brief: unknown },
  actorId: string,
) {
  if (!actorId || source.ownerId !== actorId || source.isDemo)
    throw Error("CAMPAIGN_COPY_FORBIDDEN");
  const brief = campaignSchema.parse(source.brief);
  return campaignSchema.parse({
    title: `${brief.title.slice(0, 114)} (복제)`,
    product: brief.product,
    category: brief.category,
    vibes: [...brief.vibes],
    format: brief.format,
    platforms: [...brief.platforms],
    budget_krw: brief.budget_krw,
    target_audience: brief.target_audience,
    goal: brief.goal,
    status: "draft",
    ...(brief.policy ? { policy: { ...brief.policy } } : {}),
    ...(brief.terms ? { terms: structuredClone(brief.terms) } : {}),
  });
}
