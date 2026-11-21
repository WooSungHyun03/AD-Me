import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
const steps = [
  "access_blocked",
  "sessions_revoked",
  "sources_blocked",
  "storage_handled",
  "derived_handled",
  "auth_deleted",
] as const;
export const deletionJobSchema = z
  .strictObject({
    id: z.uuid(),
    actorId: z.uuid(),
    lease: z.uuid(),
    reauthVerifiedAt: z.iso.datetime({ offset: true }),
    requestAcceptedAt: z.iso.datetime({ offset: true }),
    completed: z.array(z.enum(steps)).max(steps.length),
    version: z.number().int().nonnegative(),
    retentionPlanHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
  })
  .superRefine((v, c) => {
    if (
      new Set(v.completed).size !== v.completed.length ||
      v.completed.some((s, i) => s !== steps[i]) ||
      (v.completed.length > 2 && !v.retentionPlanHash) ||
      Date.parse(v.requestAcceptedAt) > Date.now() + 5000 ||
      Date.parse(v.reauthVerifiedAt) > Date.parse(v.requestAcceptedAt) ||
      Date.parse(v.requestAcceptedAt) - Date.parse(v.reauthVerifiedAt) > 300000
    )
      c.addIssue({
        code: "custom",
        message: "Invalid deletion proof/checkpoint",
      });
  });
export const deletionRetentionPlanSchema = z.strictObject({
  approved: z.literal(true),
  reviewRef: z.string().min(8).max(200),
  version: z.string().min(1).max(80),
  exceptions: z
    .array(
      z.strictObject({
        entity: z.string().min(1).max(80),
        field: z.string().min(1).max(80),
        basisRef: z.string().min(8).max(200),
        until: z.iso.datetime({ offset: true }),
      }),
    )
    .max(100),
});
export type DeletionJob = z.infer<typeof deletionJobSchema>;
type Plan = z.infer<typeof deletionRetentionPlanSchema>;
// D079 supplies durable leases/checkpoints, reviewed retention/quarantine and
// restore replay. No production adapter or public destructive endpoint is
// enabled by this contract module. Each effect must be idempotent by job.id.
export interface AccountDeletionAdapter {
  claim(requestId: string): Promise<unknown | null>;
  blockAccess(job: DeletionJob): Promise<void>;
  verifyCurrentAccessBlocked(job: DeletionJob): Promise<boolean>;
  revokeSessions(job: DeletionJob): Promise<void>;
  retentionPlan(job: DeletionJob): Promise<unknown>;
  pinRetentionPlan(job: DeletionJob, hash: string): Promise<unknown>;
  blockSourceReintroduction(job: DeletionJob, plan: Plan): Promise<void>;
  handleStorage(job: DeletionJob, plan: Plan): Promise<void>;
  verifyStorageRevoked(job: DeletionJob): Promise<boolean>;
  handleDerivedData(job: DeletionJob, plan: Plan): Promise<void>;
  verifyNoUnplannedReferences(job: DeletionJob, plan: Plan): Promise<boolean>;
  deleteAuth(job: DeletionJob): Promise<void>;
  advance(job: DeletionJob, step: (typeof steps)[number]): Promise<unknown>;
  finish(job: DeletionJob, plan: Plan): Promise<void>;
  release(
    job: DeletionJob,
    code: "RETENTION_REVIEW_REQUIRED" | "DELETION_RETRY_REQUIRED",
  ): Promise<void>;
}
export async function executeAccountDeletion(
  adapter: AccountDeletionAdapter,
  requestId: string,
) {
  z.uuid().parse(requestId);
  const claimed = await adapter.claim(requestId);
  if (claimed === null) return { state: "not_claimed" as const };
  let job = deletionJobSchema.parse(claimed);
  if (job.id !== requestId) throw Error("DELETION_SCOPE_MISMATCH");
  async function advance(step: (typeof steps)[number]) {
    const next = deletionJobSchema.parse(await adapter.advance(job, step));
    if (
      next.id !== job.id ||
      next.actorId !== job.actorId ||
      next.lease !== job.lease ||
      next.version !== job.version + 1 ||
      next.completed.join(",") !== [...job.completed, step].join(",")
    )
      throw Error("DELETION_CHECKPOINT_MISMATCH");
    job = next;
  }
  try {
    if (!job.completed.includes("access_blocked")) {
      await adapter.blockAccess(job);
      if (!(await adapter.verifyCurrentAccessBlocked(job)))
        throw Error("ACCESS_NOT_BLOCKED");
      await advance("access_blocked");
    }
    // A revoked Auth session does not by itself invalidate outstanding JWTs.
    if (!(await adapter.verifyCurrentAccessBlocked(job)))
      throw Error("ACCESS_NOT_BLOCKED");
    if (!job.completed.includes("sessions_revoked")) {
      await adapter.revokeSessions(job);
      await advance("sessions_revoked");
    }
    const parsed = deletionRetentionPlanSchema.safeParse(
      await adapter.retentionPlan(job),
    );
    if (!parsed.success) {
      await adapter.release(job, "RETENTION_REVIEW_REQUIRED");
      return { state: "waiting_retention_review" as const };
    }
    const plan = parsed.data;
    const planHash = createHash("sha256")
      .update(JSON.stringify(plan))
      .digest("hex");
    if (job.retentionPlanHash && job.retentionPlanHash !== planHash)
      throw Error("RETENTION_PLAN_CHANGED");
    if (!job.retentionPlanHash) {
      const pinned = deletionJobSchema.parse(
        await adapter.pinRetentionPlan(job, planHash),
      );
      if (
        pinned.id !== job.id ||
        pinned.actorId !== job.actorId ||
        pinned.lease !== job.lease ||
        pinned.version !== job.version + 1 ||
        pinned.retentionPlanHash !== planHash ||
        pinned.completed.join(",") !== job.completed.join(",")
      )
        throw Error("RETENTION_PIN_MISMATCH");
      job = pinned;
    }
    for (const exception of plan.exceptions)
      if (Date.parse(exception.until) <= Date.now())
        throw Error("RETENTION_EXCEPTION_EXPIRED");
    if (!job.completed.includes("sources_blocked")) {
      await adapter.blockSourceReintroduction(job, plan);
      await advance("sources_blocked");
    }
    if (!job.completed.includes("storage_handled")) {
      await adapter.handleStorage(job, plan);
      if (!(await adapter.verifyStorageRevoked(job)))
        throw Error("STORAGE_NOT_REVOKED");
      await advance("storage_handled");
    }
    if (!(await adapter.verifyStorageRevoked(job)))
      throw Error("STORAGE_NOT_REVOKED");
    if (!job.completed.includes("derived_handled")) {
      await adapter.handleDerivedData(job, plan);
      await advance("derived_handled");
    }
    if (!(await adapter.verifyNoUnplannedReferences(job, plan)))
      throw Error("UNPLANNED_REFERENCES");
    if (!job.completed.includes("auth_deleted")) {
      await adapter.deleteAuth(job);
      await advance("auth_deleted");
    }
    await adapter.finish(job, plan);
    return { state: "completed" as const };
  } catch {
    await adapter.release(job, "DELETION_RETRY_REQUIRED");
    return { state: "retry_required" as const };
  }
}
