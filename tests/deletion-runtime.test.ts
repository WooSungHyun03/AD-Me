import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  deletionRequestSchema,
  deletionClaimSchema,
} from "@/lib/deletion-runtime";
it("requires explicit confirmation and a private256-bit receipt, refusing caller identity/time overrides", () => {
  const good = {
    id: randomUUID(),
    receipt: "a".repeat(64),
    password: "test-only-password",
    confirmation: "계정 삭제 요청",
  };
  expect(deletionRequestSchema.safeParse(good).success).toBe(true);
  for (const bad of [
    { ...good, actorId: randomUUID() },
    { ...good, reauthAt: "2099-01-01" },
    { ...good, receipt: "short" },
    { ...good, confirmation: "확인" },
    { ...good, code: "123" },
  ])
    expect(deletionRequestSchema.safeParse(bad).success).toBe(false);
});
it("bounds quarantine batches and binds source/target paths to the verified actor and request", () => {
  const id = randomUUID(),
    actorId = randomUUID(),
    file = randomUUID();
  const good = {
    id,
    actorId,
    lease: randomUUID(),
    authRestricted: false,
    files: [
      {
        id: file,
        source: `${actorId}/${file}.png`,
        target: `${id}/${file}.png`,
        hash: "a".repeat(64),
        bytes: 100,
        sourceState: "verified",
        phase: "pending",
      },
    ],
  };
  expect(deletionClaimSchema.safeParse(good).success).toBe(true);
  for (const bad of [
    {
      ...good,
      files: [{ ...good.files[0], source: `${randomUUID()}/${file}.png` }],
    },
    { ...good, files: [{ ...good.files[0], target: "../foreign.png" }] },
    { ...good, files: [...good.files, ...good.files] },
    { ...good, files: [{ ...good.files[0], bytes: 5242881 }] },
  ])
    expect(deletionClaimSchema.safeParse(bad).success).toBe(false);
});
