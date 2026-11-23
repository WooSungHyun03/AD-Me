import "server-only";
import { z } from "zod";
import {
  creatorIdentitySchema,
  metricObservationSchema,
} from "./creator-contract";

// Private owner snapshot, NOT a replacement for the public catalog DTO.
const storedMetricSchema = metricObservationSchema
  .strict()
  .superRefine((m, ctx) => {
    if (m.value === null) return;
    if (
      (m.unit === "percent" && m.value > 100) ||
      (m.unit === "count" && !Number.isSafeInteger(m.value))
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid metric unit or precision",
      });
  });

export const storedIdentitySchema = z
  .strictObject({
    identity: creatorIdentitySchema.strict(),
    sourceType: z.enum([
      "official_api",
      "owner_submission",
      "approved_web",
      "synthetic_demo",
    ]),
    policyVersion: z.string().trim().min(1).max(80),
    collectedAt: z.iso.datetime({ offset: true }),
    metrics: z.array(storedMetricSchema).max(200),
    metricsTruncated: z.boolean(),
  })
  .superRefine((entry, ctx) => {
    const i = entry.identity;
    if (
      (entry.sourceType === "synthetic_demo") !== i.isDemo ||
      (i.claimStatus === "claimed" && i.ownerId === null) ||
      (i.publicationStatus === "published" &&
        (i.claimStatus !== "claimed" ||
          !i.ownerConsent ||
          i.moderationStatus !== "allowed"))
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent identity provenance or publication",
      });
  });

export const creatorIdentitySnapshotSchema = z
  .strictObject({
    version: z.literal(1),
    creatorId: z.uuid(),
    legacyCreatorId: z.string().min(1),
    legacyProfile: z.object({ is_demo: z.boolean() }).passthrough(),
    identities: z.array(storedIdentitySchema).max(50),
    identitiesTruncated: z.boolean(),
  })
  .superRefine((snapshot, ctx) => {
    if (
      snapshot.identities.some(
        (e) => e.identity.isDemo !== snapshot.legacyProfile.is_demo,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Legacy and normalized demo provenance disagree",
      });
    const keys = snapshot.identities.map((e) =>
      JSON.stringify([e.identity.provider, e.identity.externalId]),
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: "custom", message: "Duplicate provider identity" });
  });

export type CreatorIdentitySnapshot = z.infer<
  typeof creatorIdentitySnapshotSchema
>;

// The caller supplies its authenticated Supabase client. No UID argument, no
// service credential, no fallback to fictional metrics on a DB/schema failure.
export async function readOwnCreatorIdentitySnapshot(db: {
  rpc(
    name: "my_creator_identity_snapshot",
  ): PromiseLike<{ data: unknown; error: unknown }>;
}): Promise<CreatorIdentitySnapshot | null> {
  const { data, error } = await db.rpc("my_creator_identity_snapshot");
  if (error) throw new Error("크리에이터 식별 정보를 불러오지 못했습니다.");
  if (data === null) return null;
  const parsed = creatorIdentitySnapshotSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("크리에이터 식별 정보의 형식이 올바르지 않습니다.");
  return parsed.data;
}

// Legacy JSON and its numeric semantics remain separate from provider metrics.
// In particular, never fill a missing provider observation with legacy followers.
export function legacyCreatorCompatibility(snapshot: CreatorIdentitySnapshot) {
  return {
    legacyCreatorId: snapshot.legacyCreatorId,
    profile: structuredClone(snapshot.legacyProfile),
    normalized: snapshot.identities,
    truncated:
      snapshot.identitiesTruncated ||
      snapshot.identities.some((e) => e.metricsTruncated),
  };
}
