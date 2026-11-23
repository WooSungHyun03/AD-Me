import { randomBytes } from "node:crypto";
import { expect, it, vi } from "vitest";
import {
  createInstagramState,
  consumeInstagramState,
  sealInstagramGrant,
  openInstagramGrant,
  refreshInstagramGrant,
} from "@/lib/ingestion/instagram";
const binding = {
    ownerId: "ad000000-0000-4000-8000-000000000301",
    appId: "fictional-app",
    keyId: "local-test",
  },
  key = randomBytes(32),
  grant = {
    accessToken: "fictional-token",
    subject: "fictional-subject",
    scopes: ["fixture_scope"],
    expiresAt: "2099-01-01T00:00:00Z",
  };
it("binds authenticated encryption to owner/app/key and rejects corruption without leaking token", () => {
  const e = sealInstagramGrant(grant, binding, key);
  expect(JSON.stringify(e)).not.toContain(grant.accessToken);
  expect(openInstagramGrant(e, binding, key)).toEqual(grant);
  for (const b of [
    { ...binding, appId: "other" },
    { ...binding, ownerId: "ad000000-0000-4000-8000-000000000302" },
    { ...binding, keyId: "other" },
  ])
    expect(() => openInstagramGrant(e, b, key)).toThrow("UNAVAILABLE");
  expect(() =>
    openInstagramGrant(
      { ...e, ciphertext: (e.ciphertext[0] === "A" ? "B" : "A") + e.ciphertext.slice(1) },
      binding,
      key,
    ),
  ).toThrow("UNAVAILABLE");
});
it("consumes state once, rejects cross-account and expired callbacks before repository access", async () => {
  const { state, record } = createInstagramState(binding, 1000);
  let used = false;
  const consume = vi.fn(async () => {
    if (used) return false;
    used = true;
    return true;
  });
  await consumeInstagramState(state, record, binding, consume, 1001);
  await expect(
    consumeInstagramState(state, record, binding, consume, 1001),
  ).rejects.toThrow("STATE");
  consume.mockClear();
  await expect(
    consumeInstagramState(
      state,
      record,
      { ...binding, appId: "other" },
      consume,
      1001,
    ),
  ).rejects.toThrow("STATE");
  expect(consume).not.toHaveBeenCalled();
  await expect(
    consumeInstagramState(state, record, binding, consume, 301000),
  ).rejects.toThrow("STATE");
});
it("refuses scope reduction, account substitution and a revoke/refresh race", async () => {
  const input = {
    active: true,
    generation: 1,
    binding,
    envelope: sealInstagramGrant(grant, binding, key),
    key,
    approvedScopes: grant.scopes,
  };
  const ports = {
    refresh: vi.fn(async () => grant),
    saveIfActive: vi.fn(async () => false),
  };
  await expect(refreshInstagramGrant(input, ports)).rejects.toThrow("CHANGED");
  ports.refresh.mockResolvedValue({ ...grant, scopes: [] });
  ports.saveIfActive.mockClear();
  await expect(refreshInstagramGrant(input, ports)).rejects.toThrow();
  expect(ports.saveIfActive).not.toHaveBeenCalled();
  ports.refresh.mockClear();
  await expect(
    refreshInstagramGrant({ ...input, active: false }, ports),
  ).rejects.toThrow("DISABLED");
  expect(ports.refresh).not.toHaveBeenCalled();
});
