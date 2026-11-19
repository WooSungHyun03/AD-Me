import { z } from "zod";
import { safeHttpsLink } from "../social-links";

const publicSource = z
  .string()
  .max(2000)
  .refine((value) => Boolean(safeHttpsLink(value)));
const version = z.string().min(1).max(80);
const time = z.iso.datetime({ offset: true });

export const providerKeySchema = z.object({
  provider: z.enum(["youtube", "instagram", "tiktok", "approved_web"]),
  externalId: z.string().min(1).max(256),
});

export const creatorIdentitySchema = providerKeySchema.extend({
  id: z.uuid(),
  handle: z.string().min(1).max(160).nullable(),
  displayName: z.string().trim().min(1).max(160),
  canonicalUrl: publicSource,
  observedAt: time,
  claimStatus: z.enum(["unclaimed", "pending", "claimed"]),
  ownerId: z.uuid().nullable(),
  ownerConsent: z.boolean(),
  publicationStatus: z.enum(["private", "published"]),
  moderationStatus: z.enum(["allowed", "restricted"]),
  isDemo: z.boolean(),
});

export const metricObservationSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,79}$/),
  value: z.number().nonnegative().nullable(),
  unit: z.enum(["count", "percent", "ratio"]),
  observedAt: time,
  sourceUrl: publicSource,
  policyVersion: version,
  kind: z.enum(["original", "derived"]),
});

type CreatorIdentity = z.infer<typeof creatorIdentitySchema>;
type MetricObservation = z.infer<typeof metricObservationSchema>;

export function creatorPublicIdentity(
  identity: CreatorIdentity,
  publishedMetrics: readonly MetricObservation[],
) {
  if (
    identity.publicationStatus !== "published" ||
    identity.moderationStatus !== "allowed"
  )
    return null;
  const {
    id,
    provider,
    handle,
    displayName,
    canonicalUrl,
    observedAt,
    isDemo,
    claimStatus,
    ownerConsent,
  } = identity;
  return {
    id,
    provider,
    handle,
    displayName,
    canonicalUrl,
    observedAt,
    isDemo,
    canRequestCollaboration:
      !isDemo &&
      claimStatus === "claimed" &&
      ownerConsent &&
      identity.ownerId !== null,
    metrics: publishedMetrics.map(
      ({ name, value, unit, observedAt, sourceUrl, policyVersion, kind }) => ({
        name,
        value,
        unit,
        observedAt,
        sourceUrl,
        policyVersion,
        kind,
      }),
    ),
  };
}
