import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { runEmbeddingExperiment } from "@/lib/matching-experiments";
const d = {
  id: randomUUID(),
  ownerId: randomUUID(),
  revision: 1,
  text: "Fictional approved sample",
  provider: "owner_registration",
  policyVersion: "fixture1",
  reviewRef: "fictional-review",
  approvedForEmbedding: true,
  sourceDeleted: false,
  consentActive: true,
};
const e = {
  id: randomUUID(),
  version: "experiment1",
  baselineVersion: "baseline1",
  model: "fixture-model",
  maxCostCents: 10,
  estimatedCostCents: 2,
  dimensions: 2,
};
const ports = () => ({
  reserveCost: vi.fn(async () => true),
  embed: vi.fn(async () => [0, 1]),
  saveIfCurrent: vi.fn<
    Parameters<typeof runEmbeddingExperiment>[2]["saveIfCurrent"]
  >(async () => true),
});
it("does not call a provider without source/consent/policy/budget approval", async () => {
  const p = ports();
  for (const patch of [
    { provider: "youtube" },
    { consentActive: false },
    { sourceDeleted: true },
    { approvedForEmbedding: false },
  ])
    await expect(
      runEmbeddingExperiment({ ...d, ...patch }, e, p),
    ).rejects.toThrow();
  expect(p.embed).not.toHaveBeenCalled();
  p.reserveCost.mockResolvedValue(false);
  await expect(runEmbeddingExperiment(d, e, p)).rejects.toThrow("BUDGET");
  expect(p.embed).not.toHaveBeenCalled();
});
it("keeps baseline immutable and refuses source deletion/revision races or malformed vectors", async () => {
  const p = ports();
  p.saveIfCurrent.mockResolvedValue(false);
  await expect(runEmbeddingExperiment(d, e, p)).rejects.toThrow(
    "SOURCE_CHANGED",
  );
  expect(p.saveIfCurrent.mock.calls[0][0]).toMatchObject({
    revision: 1,
    ownerId: d.ownerId,
    policyVersion: d.policyVersion,
  });
  p.embed.mockResolvedValue([NaN, 1]);
  p.saveIfCurrent.mockClear();
  await expect(runEmbeddingExperiment(d, e, p)).rejects.toThrow();
  expect(p.saveIfCurrent).not.toHaveBeenCalled();
  await expect(
    runEmbeddingExperiment(d, { ...e, version: e.baselineVersion }, p),
  ).rejects.toThrow("CONFIG");
});
