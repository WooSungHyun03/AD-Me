import { z } from "zod";
import type { Creator } from "@/lib/catalog";
import { normalizeSocialLink, safeHttpsLink } from "@/lib/social-links";

export type PublicCatalogCreator = Omit<
  Creator,
  | "owner_id"
  | "owner_consent"
  | "followers"
  | "price_min_krw"
  | "price_max_krw"
  | "is_available"
> & {
  followers: number | null;
  // D026: null = 견적 미확인 (both null together); never coerced to 0.
  price_min_krw: number | null;
  price_max_krw: number | null;
  is_available: boolean | null; // D026: null = 협업 의사 미확인
};
// Contract of the database allowlist, never a raw legacy profile. Unknown keys
// fail closed so a future SQL change cannot silently reintroduce private fields.
export const publicCatalogCreatorSchema = z
  .strictObject({
    seed_id: z.string().min(1).max(100),
    name: z.string().min(2).max(80),
    handle: z.string().max(160),
    bio: z.string().max(1000),
    categories: z.array(z.string().max(50)).max(5),
    vibes: z.array(z.string().max(50)).max(8),
    formats: z.array(z.string().max(50)).max(8),
    platforms: z.array(z.string().max(50)).max(5),
    price_min_krw: z.number().int().min(0).max(100000000).nullable(),
    price_max_krw: z.number().int().min(0).max(100000000).nullable(),
    followers: z.number().int().min(0).max(10000000000).nullable(),
    metrics_source: z.enum(["synthetic_demo_not_verified", "unavailable"]),
    is_available: z.boolean().nullable(),
    is_demo: z.boolean(),
    data_source: z.enum([
      "generated fictional test fixture",
      "owner_registration",
    ]),
    source_url: z.string().max(2000).nullable(),
    portrait_asset: z.null(),
    image_placeholder: z.enum(["gradient_initials", "initials"]),
    published: z.literal(true),
    social_url: z.string().max(2000).optional(),
    portfolio_url: z.string().max(2000).optional(),
  })
  .superRefine((p, ctx) => {
    if (
      (!p.is_demo && p.followers !== null) ||
      (p.metrics_source === "unavailable" && p.followers !== null) ||
      p.source_url !== (p.social_url ?? null) ||
      (p.price_min_krw === null) !== (p.price_max_krw === null) ||
      (p.price_min_krw !== null && p.price_max_krw! < p.price_min_krw)
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid public catalog provenance",
      });
  })
  .transform((p) => {
    // A malformed optional public link must not take down the whole catalog.
    // Unknown/private keys still fail the strict object check above.
    const { social_url, portfolio_url, ...base } = p;
    const social = normalizeSocialLink(social_url);
    const portfolio = safeHttpsLink(portfolio_url);
    return {
      ...base,
      source_url: social?.href ?? null,
      ...(social ? { social_url: social.href } : {}),
      ...(portfolio ? { portfolio_url: portfolio.href } : {}),
    };
  });
const tags = (maximum: number) => z.array(z.string().max(50)).max(maximum);
const profile = z.object({
  name: z.string().min(2).max(80),
  handle: z.string().max(160),
  bio: z.string().max(1000),
  categories: tags(5),
  vibes: tags(8),
  formats: tags(8),
  platforms: tags(5),
  price_min_krw: z.number().int().min(0).max(100000000).nullable(),
  price_max_krw: z.number().int().min(0).max(100000000).nullable(),
  followers: z.number().int().min(0).max(10000000000).nullable().optional(),
  is_available: z.boolean().nullable(),
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

// Legacy/keyless projection without raw JSON spreading. Configured public reads
// use the DB allowlist and staged activation boundary. Legacy IDs remain intact.
export function projectPublicCreator(
  input: unknown,
): PublicCatalogCreator | null {
  const row = rowSchema.safeParse(input);
  if (!row.success || !row.data.published) return null;
  const parsed = profile.safeParse(row.data.profile);
  if (
    !parsed.success ||
    (parsed.data.price_min_krw === null) !==
      (parsed.data.price_max_krw === null) ||
    (parsed.data.price_min_krw !== null &&
      parsed.data.price_min_krw > parsed.data.price_max_krw!)
  )
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
