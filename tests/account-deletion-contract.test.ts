import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import {
  executeAccountDeletion,
  deletionJobSchema,
  type AccountDeletionAdapter,
  type DeletionJob,
} from "@/lib/account-deletion";
function fixture() {
  let job: DeletionJob = {
      id: randomUUID(),
      actorId: randomUUID(),
      lease: randomUUID(),
      reauthVerifiedAt: new Date(Date.now() - 1000).toISOString(),
      requestAcceptedAt: new Date().toISOString(),
      completed: [],
      version: 0,
    },
    leased = false;
  const adapter: AccountDeletionAdapter = {
    claim: vi.fn(async () => {
      if (leased) return null;
      leased = true;
      return job;
    }),
    blockAccess: vi.fn(async () => {}),
    verifyCurrentAccessBlocked: vi.fn(async () => true),
    revokeSessions: vi.fn(async () => {}),
    retentionPlan: vi.fn(async () => ({
      approved: true,
      reviewRef: "FICTIONAL REVIEW ONLY",
      version: "fixture-1",
      exceptions: [],
    })),
    pinRetentionPlan: vi.fn(async (j, hash) => {
      job = { ...j, retentionPlanHash: hash, version: j.version + 1 };
      return job;
    }),
    blockSourceReintroduction: vi.fn(async () => {}),
    handleStorage: vi.fn(async () => {}),
    verifyStorageRevoked: vi.fn(async () => true),
    handleDerivedData: vi.fn(async () => {}),
    verifyNoUnplannedReferences: vi.fn(async () => true),
    deleteAuth: vi.fn(async () => {}),
    advance: vi.fn(async (j, step) => {
      job = { ...j, completed: [...j.completed, step], version: j.version + 1 };
      return job;
    }),
    finish: vi.fn(async () => {
      leased = false;
    }),
    release: vi.fn(async () => {
      leased = false;
    }),
  };
  return { adapter, id: job.id };
}
it("requires recent server proof at request acceptance and ordered nonduplicated checkpoints", () => {
  const f = fixture();
  expect(
    deletionJobSchema.safeParse({
      id: f.id,
      actorId: randomUUID(),
      lease: randomUUID(),
      reauthVerifiedAt: "2026-11-01T00:00:00Z",
      requestAcceptedAt: "2026-11-21T00:00:00Z",
      completed: [],
      version: 0,
    }).success,
  ).toBe(false);
});
it("keeps access blocked but never purges anything while D079 retention approval is missing", async () => {
  const { adapter, id } = fixture();
  vi.mocked(adapter.retentionPlan).mockResolvedValue({ approved: false });
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "waiting_retention_review",
  });
  expect(adapter.blockAccess).toHaveBeenCalledOnce();
  expect(adapter.revokeSessions).toHaveBeenCalledOnce();
  expect(adapter.handleStorage).not.toHaveBeenCalled();
  expect(adapter.deleteAuth).not.toHaveBeenCalled();
});
it("does not accept Auth signout or an unverifiable Storage revocation as complete erasure", async () => {
  const { adapter, id } = fixture();
  vi.mocked(adapter.verifyCurrentAccessBlocked).mockResolvedValue(false);
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "retry_required",
  });
  expect(adapter.deleteAuth).not.toHaveBeenCalled();
  const b = fixture();
  vi.mocked(b.adapter.verifyStorageRevoked).mockResolvedValue(false);
  expect(await executeAccountDeletion(b.adapter, b.id)).toEqual({
    state: "retry_required",
  });
  expect(b.adapter.deleteAuth).not.toHaveBeenCalled();
});
it("rejects a different retention plan on retry after a checkpoint has pinned the original review", async () => {
  const { adapter, id } = fixture();
  vi.mocked(adapter.handleStorage).mockRejectedValueOnce(
    Error("fixture interruption"),
  );
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "retry_required",
  });
  vi.mocked(adapter.retentionPlan).mockResolvedValue({
    approved: true,
    reviewRef: "DIFFERENT FICTIONAL REVIEW",
    version: "fixture-2",
    exceptions: [],
  });
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "retry_required",
  });
  expect(adapter.deleteAuth).not.toHaveBeenCalled();
});
it("resumes a failed storage operation using durable checkpoints and only one claimed worker performs deletion", async () => {
  const { adapter, id } = fixture();
  vi.mocked(adapter.handleStorage).mockRejectedValueOnce(
    Error("fictional interrupted operation"),
  );
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "retry_required",
  });
  expect(await executeAccountDeletion(adapter, id)).toEqual({
    state: "completed",
  });
  expect(adapter.revokeSessions).toHaveBeenCalledOnce();
  expect(adapter.blockSourceReintroduction).toHaveBeenCalledOnce();
  expect(adapter.handleStorage).toHaveBeenCalledTimes(2);
  expect(adapter.deleteAuth).toHaveBeenCalledOnce();
  const b = fixture();
  const result = await Promise.all([
    executeAccountDeletion(b.adapter, b.id),
    executeAccountDeletion(b.adapter, b.id),
  ]);
  expect(result.map((x) => x.state).sort()).toEqual([
    "completed",
    "not_claimed",
  ]);
  expect(b.adapter.deleteAuth).toHaveBeenCalledOnce();
});
