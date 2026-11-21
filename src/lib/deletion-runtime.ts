import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
export const deletionReceiptSchema = z.strictObject({
  id: z.uuid(),
  receipt: z.string().regex(/^[a-f0-9]{64}$/),
});
export const deletionRequestSchema = deletionReceiptSchema.extend({
  password: z.string().min(1).max(128),
  code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
  confirmation: z.literal("계정 삭제 요청"),
});
export const deletionStatusSchema = z.strictObject({
  id: z.uuid(),
  state: z.enum([
    "quarantining",
    "waiting_retention",
    "waiting_review",
    "retry_required",
    "erasing",
    "erased",
  ]),
  acceptedAt: z.iso.datetime({ offset: true }),
  authRestricted: z.boolean(),
  storageRevoked: z.boolean(),
  errorCode: z.string().nullable(),
});
export type DeletionReceipt = z.infer<typeof deletionReceiptSchema>;
const fileSchema = z.strictObject({
  id: z.uuid(),
  source: z.string(),
  target: z.string(),
  hash: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().min(1).max(5242880),
  sourceState: z.enum(["pending", "verified"]),
  phase: z.enum(["pending", "copied"]),
});
export const deletionClaimSchema = z
  .strictObject({
    id: z.uuid(),
    actorId: z.uuid(),
    lease: z.uuid(),
    authRestricted: z.boolean(),
    files: z.array(fileSchema).max(5),
  })
  .superRefine((job, ctx) => {
    if (
      new Set(job.files.map((f) => f.id)).size !== job.files.length ||
      job.files.some(
        (f) =>
          f.source !== `${job.actorId}/${f.id}.png` ||
          f.target !== `${job.id}/${f.id}.png`,
      )
    )
      ctx.addIssue({ code: "custom", message: "Invalid quarantine scope" });
  });
export async function readDeletionStatus(
  admin: SupabaseClient,
  input: DeletionReceipt,
) {
  const r = await admin.rpc("deletion_status", {
    p_id: input.id,
    p_receipt: input.receipt,
  });
  if (r.error) throw Error("DELETION_STATUS_UNAVAILABLE");
  return r.data === null ? null : deletionStatusSchema.parse(r.data);
}
const missing = (error: unknown) => {
  const e = error as { status?: number; statusCode?: string | number };
  return e?.status === 404 || Number(e?.statusCode) === 404;
};
function validBytes(data: ArrayBuffer, hash: string, size: number) {
  if (
    data.byteLength !== size ||
    createHash("sha256").update(Buffer.from(data)).digest("hex") !== hash
  )
    throw Error("QUARANTINE_INTEGRITY_REQUIRED");
  return Buffer.from(data);
}
// At most5 files, each<=5MiB per invocation. Lease/checkpoint state is in Postgres.
// This runner intentionally has no permanent-erase/Auth-delete operation before D079 approval.
export async function advanceDeletionQuarantine(
  admin: SupabaseClient,
  input: DeletionReceipt,
) {
  const claimed = await admin.rpc("deletion_claim", {
    p_id: input.id,
    p_receipt: input.receipt,
  });
  if (claimed.error) throw Error("DELETION_CLAIM_UNAVAILABLE");
  if (!claimed.data) return readDeletionStatus(admin, input);
  const job = deletionClaimSchema.parse(claimed.data);
  if (job.id !== input.id) throw Error("DELETION_SCOPE_MISMATCH");
  const checkpoint = async (
    phase: string,
    file: string | null = null,
    error = false,
  ) => {
    const r = await admin.rpc("deletion_checkpoint", {
      p_id: job.id,
      p_lease: job.lease,
      p_file: file,
      p_phase: phase,
      p_error: error,
    });
    if (r.error || r.data !== true) throw Error("DELETION_LEASE_LOST");
  };
  try {
    if (!job.authRestricted) {
      const banned = await admin.auth.admin.updateUserById(job.actorId, {
        ban_duration: "876000h",
      });
      if (banned.error) throw Error("AUTH_RESTRICTION_REQUIRED");
      const verified = await admin.auth.admin.getUserById(job.actorId);
      const until = (
        verified.data.user as unknown as { banned_until?: string } | null
      )?.banned_until;
      if (verified.error || !until || Date.parse(until) <= Date.now())
        throw Error("AUTH_RESTRICTION_NOT_VERIFIED");
      await checkpoint("auth_restricted");
    }
    const source = admin.storage.from("adme-private-images"),
      target = admin.storage.from("adme-privacy-quarantine");
    for (const file of job.files) {
      // Verify retained bytes on every retry, including a crash after removing source.
      let stored = await target.download(file.target);
      if (stored.error && !missing(stored.error))
        throw Error("QUARANTINE_READ_REQUIRED");
      if (!stored.data) {
        const original = await source.download(file.source);
        if (original.error || !original.data) {
          if (
            file.sourceState === "pending" &&
            file.phase === "pending" &&
            missing(original.error)
          ) {
            await checkpoint("absent_pending", file.id);
            continue;
          }
          throw Error("SOURCE_BYTES_UNVERIFIED");
        }
        const bytes = validBytes(
          await original.data.arrayBuffer(),
          file.hash,
          file.bytes,
        );
        const copied = await target.upload(file.target, bytes, {
          upsert: false,
          contentType: "image/png",
          cacheControl: "0",
        });
        if (
          copied.error &&
          !["409", "400"].includes(
            String(
              (copied.error as unknown as { statusCode?: string }).statusCode,
            ),
          )
        )
          throw Error("QUARANTINE_COPY_REQUIRED");
        stored = await target.download(file.target);
      }
      if (stored.error || !stored.data)
        throw Error("QUARANTINE_COPY_UNVERIFIED");
      validBytes(await stored.data.arrayBuffer(), file.hash, file.bytes);
      await checkpoint("copied", file.id);
      const removed = await source.remove([file.source]);
      if (removed.error) throw Error("SOURCE_REMOVAL_REQUIRED");
      const remaining = await source.download(file.source);
      if (remaining.data || !missing(remaining.error))
        throw Error("SOURCE_REMOVAL_UNVERIFIED");
      await checkpoint("source_removed", file.id);
    }
    await checkpoint("release");
  } catch {
    // Never forward provider response bodies, object paths or authentication material.
    await checkpoint("retry", null, true);
  }
  return readDeletionStatus(admin, input);
}
