import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { productConditionSource } from "../product-conditions";
const channel = z.string().regex(/^UC[A-Za-z0-9_-]{22}$/);
export const ingestionCheckpointSchema = z
  .strictObject({
    version: z.literal(1),
    candidates: z.array(channel).max(25),
    completed: z.array(channel).max(25),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.candidates).size !== v.candidates.length ||
      new Set(v.completed).size !== v.completed.length ||
      v.completed.some((id) => !v.candidates.includes(id))
    )
      c.addIssue({ code: "custom", message: "Invalid checkpoint membership" });
  });
export const ingestionLeaseSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum([
      "youtube_channel",
      "youtube_daily",
      "youtube_claim",
      "marketing_draft",
    ]),
    input: z.string().max(1600),
    lease: z.uuid(),
    policyVersion: z.string().min(1).max(80).optional(),
    cacheTtlSeconds: z.number().int().min(60).max(2592000).optional(),
    checkpoint: z
      .union([z.strictObject({}), ingestionCheckpointSchema])
      .optional(),
    operation: z.literal("product_conditions_v1").optional(),
    productSource: productConditionSource.optional(),
    productSourceVersion: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .superRefine((job, ctx) => {
    const owned = [job.operation, job.productSource, job.productSourceVersion];
    if (
      owned.some((v) => v !== undefined) &&
      (owned.some((v) => v === undefined) || job.kind !== "marketing_draft")
    )
      ctx.addIssue({
        code: "custom",
        message: "Incomplete owned product operation",
      });
  });
export async function heartbeatIngestionJob(
  db: SupabaseClient,
  workerToken: string,
  job: { id: string; lease: string },
) {
  const r = await db.rpc("ops_worker_heartbeat", {
    p_token: workerToken,
    p_id: job.id,
    p_lease: job.lease,
  });
  if (r.error) throw Error("INGESTION_HEARTBEAT_FAILED");
  return r.data === true;
}
export async function checkpointIngestionJob(
  db: SupabaseClient,
  workerToken: string,
  job: { id: string; lease: string },
  candidates: string[],
  batch: unknown[] | null,
) {
  z.array(channel).max(25).parse(candidates);
  const r = await db.rpc("ops_worker_checkpoint", {
    p_token: workerToken,
    p_id: job.id,
    p_lease: job.lease,
    p_candidates: candidates,
    p_result: batch,
  });
  if (r.error) throw Error("INGESTION_CHECKPOINT_FAILED");
  return ingestionCheckpointSchema.parse(r.data);
}
