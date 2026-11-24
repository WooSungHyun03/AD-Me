import { expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ingestionCheckpointSchema,
  heartbeatIngestionJob,
  checkpointIngestionJob,
  ingestionLeaseSchema,
} from "@/lib/ingestion/jobs";
const a = "UC" + "a".repeat(22),
  b = "UC" + "b".repeat(22);
it("preserves only complete source-bound product operation metadata on marketing leases", () => {
  const job = {
    id: "00000000-0000-4000-8000-000000000001",
    lease: "00000000-0000-4000-8000-000000000002",
    kind: "marketing_draft",
    input: "opaque marker",
    operation: "product_conditions_v1",
    productSource: {
      name: "가상 제품",
      description: "음식 분야의 제품 리뷰입니다",
      audience: "가상 성인",
    },
    productSourceVersion: "a".repeat(64),
  };
  expect(ingestionLeaseSchema.parse(job).operation).toBe(
    "product_conditions_v1",
  );
  for (const extra of [
    { productSource: undefined },
    { operation: undefined },
    { kind: "youtube_channel" },
    { productSourceVersion: "forged" },
    { productSource: { ...job.productSource, ownerId: "injected" } },
  ])
    expect(ingestionLeaseSchema.safeParse({ ...job, ...extra }).success).toBe(
      false,
    );
});
it("rejects checkpoints containing duplicate, uncommitted or private response fields", () => {
  expect(
    ingestionCheckpointSchema.safeParse({
      version: 1,
      candidates: [a, b],
      completed: [a],
    }).success,
  ).toBe(true);
  for (const d of [
    { version: 1, candidates: [a, a], completed: [] },
    { version: 1, candidates: [a], completed: [b] },
    { version: 1, candidates: [a], completed: [], rawResponse: "private" },
  ])
    expect(ingestionCheckpointSchema.safeParse(d).success).toBe(false);
});
it("does not expose provider bodies/tokens when an actual transport reports a failed checkpoint", async () => {
  const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "untrusted provider body" },
    }),
    db = { rpc } as unknown as SupabaseClient,
    job = {
      id: "00000000-0000-4000-8000-000000000001",
      lease: "00000000-0000-4000-8000-000000000002",
    };
  await expect(
    checkpointIngestionJob(db, "fixture-token", job, [a], null),
  ).rejects.toThrow("INGESTION_CHECKPOINT_FAILED");
  rpc.mockResolvedValue({ data: false, error: null });
  expect(await heartbeatIngestionJob(db, "fixture-token", job)).toBe(false);
});
