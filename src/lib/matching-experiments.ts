import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
const documentSchema = z.strictObject({
  id: z.uuid(),
  revision: z.number().int().positive(),
  ownerId: z.uuid(),
  text: z.string().min(1).max(4000),
  provider: z.enum([
    "owner_registration",
    "approved_web",
    "youtube",
    "instagram",
    "tiktok",
  ]),
  policyVersion: z.string().min(1).max(80),
  reviewRef: z.string().min(8).max(200),
  approvedForEmbedding: z.literal(true),
  sourceDeleted: z.literal(false),
  consentActive: z.literal(true),
});
const experimentSchema = z.strictObject({
  id: z.uuid(),
  version: z.string().min(1).max(80),
  baselineVersion: z.string().min(1).max(80),
  model: z.string().regex(/^[a-zA-Z0-9_.-]{1,80}$/),
  maxCostCents: z.number().int().min(1).max(100),
  estimatedCostCents: z.number().int().min(1).max(100),
  dimensions: z.number().int().min(1).max(1024),
});
// Only explicit per-document permissions; source policy/consent are read again by saveIfCurrent.
export async function runEmbeddingExperiment(
  document: unknown,
  experiment: unknown,
  ports: {
    reserveCost: (
      experimentId: string,
      cents: number,
      cap: number,
    ) => Promise<boolean>;
    embed: (
      text: string,
      model: string,
      signal: AbortSignal,
    ) => Promise<unknown>;
    saveIfCurrent: (
      proof: {
        documentId: string;
        revision: number;
        ownerId: string;
        policyVersion: string;
        contentHash: string;
      },
      record: {
        experimentId: string;
        experimentVersion: string;
        baselineVersion: string;
        model: string;
        vector: number[];
      },
    ) => Promise<boolean>;
  },
) {
  const d = documentSchema.parse(document),
    e = experimentSchema.parse(experiment);
  if (d.provider === "youtube")
    throw Error("EXPERIMENT_YOUTUBE_POLICY_REVIEW_REQUIRED");
  if (e.version === e.baselineVersion || e.estimatedCostCents > e.maxCostCents)
    throw Error("EXPERIMENT_CONFIG_INVALID");
  if (!(await ports.reserveCost(e.id, e.estimatedCostCents, e.maxCostCents)))
    throw Error("EXPERIMENT_BUDGET_DENIED");
  const vector = z
    .array(z.number().finite())
    .length(e.dimensions)
    .parse(await ports.embed(d.text, e.model, AbortSignal.timeout(10000)));
  const proof = {
    documentId: d.id,
    revision: d.revision,
    ownerId: d.ownerId,
    policyVersion: d.policyVersion,
    contentHash: createHash("sha256").update(d.text).digest("hex"),
  };
  const record = {
    experimentId: e.id,
    experimentVersion: e.version,
    baselineVersion: e.baselineVersion,
    model: e.model,
    vector,
  };
  if (!(await ports.saveIfCurrent(proof, record)))
    throw Error("EXPERIMENT_SOURCE_CHANGED");
  return { experimentId: e.id, documentId: d.id, dimensions: vector.length };
}
