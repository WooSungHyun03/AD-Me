import { z } from "zod";
import { safeHttpsLink } from "./social-links";
const policy = z.strictObject({
  category: z.enum(["hard", "soft"]),
  budget: z.enum(["hard", "soft"]),
  unknown: z.enum(["hold", "exclude"]),
});
const tags = z.array(z.string().max(50)).max(8);
const fingerprint = z.string().regex(/^[a-f0-9]{32}$/);
export const recommendationCreateSchema = z.strictObject({
  campaignId: z.uuid(),
  clientKey: z.uuid(),
});
export const recommendationInputSchema = z.strictObject({
  category: z.string().max(50),
  vibes: tags,
  format: z.string().max(50),
  budget_krw: z.number().int().min(0).max(100000000),
  platforms: tags,
  policy: policy.optional(),
  includeDemo: z.boolean().optional(),
});
export const recommendationResultSchema = z
  .strictObject({
    creatorId: z.string().min(1).max(100),
    name: z.string().min(2).max(80),
    isDemo: z.boolean(),
    sourceType: z.enum([
      "generated fictional test fixture",
      "owner_registration",
    ]),
    sourceUrl: z
      .string()
      .nullable()
      .transform((v) => safeHttpsLink(v ?? undefined)?.href ?? null),
    sourceVersion: fingerprint,
    input: z.strictObject({
      id: z.string().min(1).max(100),
      published: z.literal(true),
      available: z.boolean(),
      categories: tags,
      vibes: tags,
      formats: tags,
      platforms: tags,
      price: z.number().int().min(0).max(100000000).nullable(),
      isDemo: z.boolean(),
    }),
    eligible: z.boolean(),
    version: z.literal("adme-1.2").optional(),
    status: z.enum(["eligible", "hold"]).optional(),
    policy: policy.optional(),
    reasons: z.array(z.string().min(1).max(50)).max(5).optional(),
    score: z.number().int().min(0).max(100).nullable(),
    coverage: z.number().int().min(0).max(80),
    matchedTags: tags,
    missing: z.array(z.string().max(50)).max(5),
    breakdown: z
      .array(
        z.strictObject({
          factor: z.string().max(50),
          weight: z.number().int().min(1).max(100),
          value: z.number().min(0).max(1).nullable(),
          evidence: z.string().max(1000),
        }),
      )
      .length(5),
    position: z.number().int().min(1).max(6),
  })
  .superRefine((r, ctx) => {
    if (
      r.creatorId !== r.input.id ||
      r.isDemo !== r.input.isDemo ||
      (r.version === "adme-1.2"
        ? !r.status ||
          !r.policy ||
          !r.reasons ||
          r.eligible !== (r.status === "eligible") ||
          r.score === null ||
          (r.coverage === 0 && r.score !== 0) ||
          (r.status === "hold"
            ? r.reasons.length === 0
            : r.reasons.length !== 0)
        : !r.eligible ||
          r.input.price === null ||
          r.status !== undefined ||
          r.policy !== undefined ||
          r.reasons !== undefined ||
          (r.coverage === 0) !== (r.score === null))
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid recommendation provenance",
      });
  });
const stamp = z.iso.datetime({ offset: true });
export const recommendationPageSchema = z.strictObject({
  version: z.literal(1),
  campaignId: z.uuid(),
  history: z.array(z.strictObject({ id: z.uuid(), createdAt: stamp })).max(20),
  snapshot: z
    .strictObject({
      id: z.uuid(),
      createdAt: stamp,
      modelVersion: z.enum(["adme-1.0", "adme-1.2"]),
      sourceContract: z.literal("public-catalog-v1"),
      sourceVersion: fingerprint,
      stale: z.boolean(),
      input: recommendationInputSchema,
      catalogCount: z.number().int().min(0).max(1000),
      eligibleCount: z.number().int().min(0).max(1000),
      heldCount: z.number().int().min(0).max(1000).optional(),
      withheldCount: z.number().int().min(0).max(6),
      results: z.array(recommendationResultSchema).max(6),
    })
    .superRefine((s, ctx) => {
      if (
        s.eligibleCount + (s.heldCount ?? 0) > s.catalogCount ||
        (s.modelVersion === "adme-1.2"
          ? !s.input.policy ||
            s.input.includeDemo === undefined ||
            s.heldCount === undefined ||
            s.results.some(
              (r) =>
                r.version !== "adme-1.2" ||
                JSON.stringify(r.policy) !== JSON.stringify(s.input.policy) ||
                (!s.input.includeDemo && r.isDemo),
            )
          : s.results.some((r) => r.version !== undefined))
      )
        ctx.addIssue({
          code: "custom",
          message: "Invalid recommendation model contract",
        });
    })
    .nullable(),
});
export type RecommendationPage = z.infer<typeof recommendationPageSchema>;
