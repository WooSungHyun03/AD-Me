import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import {
  applyAgreementAction,
  confirmedAgreement,
  type AgreementState,
} from "@/lib/agreement-versions";
import { campaignBriefTermsSchema } from "@/lib/campaign-brief";
const terms = campaignBriefTermsSchema.parse({
  version: 2,
  recruitment: { start: "2027-01-01T00:00", end: "2027-01-02T00:00" },
  production: { start: "2027-01-02T00:00", end: "2027-01-03T00:00" },
  posting: { start: "2027-01-03T00:00", end: "2027-01-04T00:00" },
  compensation: { mode: "unknown" },
  deliverables: [
    { format: "숏폼", quantity: 1, usageRights: "소개", exclusivity: null },
  ],
});
const state: AgreementState = {
  collaborationId: randomUUID(),
  parties: [randomUUID(), randomUUID()],
  version: 0,
  writable: true,
  offers: [],
  actions: [],
};
const propose = (s: AgreementState) => ({
  id: randomUUID(),
  kind: "propose",
  expectedVersion: s.version,
  actorId: s.parties[0],
  collaborationId: s.collaborationId,
  offerId: randomUUID(),
  terms,
});
it("retains previous confirmed terms until both parties accept a new revision", () => {
  const a = propose(state),
    first = applyAgreementAction(state, a);
  expect(confirmedAgreement(first)).toBeNull();
  const agreed = applyAgreementAction(first, {
    id: randomUUID(),
    kind: "accept",
    expectedVersion: 1,
    actorId: state.parties[1],
    collaborationId: state.collaborationId,
    offerId: a.offerId,
  });
  const next = applyAgreementAction(agreed, propose(agreed));
  expect(confirmedAgreement(next)?.id).toBe(a.offerId);
  expect(next.offers.at(-1)?.replaces).toBe(a.offerId);
  expect(state.offers).toEqual([]);
});
it("enforces party/scope/version, idempotent replay and changed-payload rejection", () => {
  const a = propose(state),
    next = applyAgreementAction(state, a);
  expect(applyAgreementAction(next, a)).toEqual(next);
  expect(() =>
    applyAgreementAction(next, { ...a, offerId: randomUUID() }),
  ).toThrow("KEY_REUSED");
  expect(() => applyAgreementAction(next, propose(state))).toThrow("STALE");
  expect(() =>
    applyAgreementAction(state, { ...a, actorId: randomUUID() }),
  ).toThrow("FORBIDDEN");
  expect(() => applyAgreementAction({ ...state, writable: false }, a)).toThrow(
    "LOCKED",
  );
});
