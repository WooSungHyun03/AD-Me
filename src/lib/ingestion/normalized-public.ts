import { z } from "zod";
import { safeHttpsLink } from "../social-links";
const url = z
  .string()
  .max(2000)
  .refine((v) => !!safeHttpsLink(v));
const stamp = z.iso.datetime({ offset: true });
const metric = z
  .strictObject({
    name: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
    value: z.number().nonnegative().nullable(),
    unit: z.enum(["count", "percent", "ratio"]),
    observedAt: stamp,
    collectedAt: stamp,
    sourceUrl: url,
    policyVersion: z.string().min(1).max(80),
    kind: z.enum(["original", "derived"]),
    stale: z.boolean(),
  })
  .superRefine((m, ctx) => {
    if (
      (m.stale && m.value !== null) ||
      (m.value !== null &&
        ((m.unit === "count" && !Number.isSafeInteger(m.value)) ||
          (m.unit === "percent" && m.value > 100)))
    )
      ctx.addIssue({ code: "custom", message: "Invalid metric value" });
  });
export const normalizedPublicSchema = z.strictObject({
  version: z.literal(1),
  creatorId: z.string().min(1).max(100),
  truncated: z.boolean(),
  identities: z
    .array(
      z.strictObject({
        id: z.uuid(),
        provider: z.enum(["youtube", "instagram", "tiktok", "approved_web"]),
        handle: z.string().max(160).nullable(),
        displayName: z.string().min(1).max(160),
        canonicalUrl: url,
        observedAt: stamp,
        isDemo: z.boolean(),
        sourceType: z.enum([
          "official_api",
          "owner_submission",
          "approved_web",
          "synthetic_demo",
        ]),
        policyVersion: z.string().min(1).max(80),
        canRequestCollaboration: z.boolean(),
        metrics: z.array(metric).max(40),
      }),
    )
    .max(10),
});
