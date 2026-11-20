import { z } from "zod";
import type { Creator } from "./catalog";
import { normalizeSocialLink, safeHttpsLink } from "./social-links";

export type PublicCatalogCreator = Omit<
  Creator,
  "owner_id" | "owner_consent" | "followers"
> & { followers: number | null };
const tags = (maximum: number) => z.array(z.string().max(50)).max(maximum);
const profile = z.object({
  name: z.string().min(2).max(80),
  handle: z.string().max(160),
  bio: z.string().max(1000),
  categories: tags(5),
  vibes: tags(8),
  formats: tags(8),
  platforms: tags(5),
  price_min_krw: z.number().int().min(0).max(100000000),
  price_max_krw: z.number().int().min(0).max(100000000),
  followers: z.number().int().min(0).max(10000000000).nullable().optional(),
  is_available: z.boolean(),
  is_demo: z.boolean(),
  metrics_source: z.string().max(80).optional(),
  owner_consent: z.boolean().optional(),
  social_url: z.string().max(2000).optional(),
  portfolio_url: z.string().max(2000).optional(),
});
const rowSchema = z.object({
  id: z.string().min(1).max(100),
  published: z.boolean(),
  profile: z.unknown(),
});

// Explicit app DTO, not raw JSON spreading. Direct DB REST and legacy public IDs
// require the separate D018/D033/D075 read migration before that release gate clears.
export function projectPublicCreator(
  input: unknown,
): PublicCatalogCreator | null {
  const row = rowSchema.safeParse(input);
  if (!row.success || !row.data.published) return null;
  const parsed = profile.safeParse(row.data.profile);
  if (!parsed.success || parsed.data.price_min_krw > parsed.data.price_max_krw)
    return null;
  const p = parsed.data;
  const social =
    p.owner_consent === true ? normalizeSocialLink(p.social_url) : null;
  const portfolio =
    p.owner_consent === true ? safeHttpsLink(p.portfolio_url) : null;
  const syntheticMetrics =
    p.is_demo && p.metrics_source === "synthetic_demo_not_verified";
  return {
    seed_id: row.data.id,
    name: p.name,
    handle: p.handle,
    bio: p.bio,
    categories: p.categories,
    vibes: p.vibes,
    formats: p.formats,
    platforms: p.platforms,
    price_min_krw: p.price_min_krw,
    price_max_krw: p.price_max_krw,
    followers: syntheticMetrics ? (p.followers ?? null) : null,
    metrics_source: syntheticMetrics
      ? "synthetic_demo_not_verified"
      : "unavailable",
    is_available: p.is_available,
    is_demo: p.is_demo,
    data_source: p.is_demo
      ? "generated fictional test fixture"
      : "owner_registration",
    source_url: social?.href ?? null,
    portrait_asset: null,
    image_placeholder: p.is_demo ? "gradient_initials" : "initials",
    published: true,
    ...(social ? { social_url: social.href } : {}),
    ...(portfolio ? { portfolio_url: portfolio.href } : {}),
  };
}
