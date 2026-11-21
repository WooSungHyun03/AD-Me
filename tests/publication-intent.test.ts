import { expect, it } from "vitest";
import {
  policyDocument,
  publicationIntent,
  publicationProofSchema,
} from "@/lib/consent";
it("retains the retry key after an uncertain response but changes it for edited or fresh intent", () => {
  const data = { published: true, name: "가상 로컬" };
  const first = publicationIntent(null, data);
  expect(publicationIntent(first, { ...data })).toBe(first);
  expect(
    publicationIntent(first, { ...data, published: false }).requestKey,
  ).not.toBe(first.requestKey);
  expect(publicationIntent(null, data).requestKey).not.toBe(first.requestKey);
});
it("rejects stale policy, forged timestamps and malformed retry keys before a publication mutation", () => {
  const valid = {
    version: policyDocument.version,
    documentHash: policyDocument.documentHash,
    requestKey: crypto.randomUUID(),
  };
  expect(publicationProofSchema.safeParse(valid).success).toBe(true);
  for (const value of [
    { ...valid, version: "old" },
    { ...valid, documentHash: "0".repeat(64) },
    { ...valid, requestKey: "missing" },
    { ...valid, recordedAt: "2099-01-01T00:00:00Z" },
  ])
    expect(publicationProofSchema.safeParse(value).success).toBe(false);
});
