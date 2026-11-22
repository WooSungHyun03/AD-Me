import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { campaignBriefTermsStorageSchema } from "./campaign-brief";
const offerSchema = z.strictObject({
  id: z.uuid(),
  authorId: z.uuid(),
  terms: campaignBriefTermsStorageSchema,
  acceptedBy: z.array(z.uuid()).min(1).max(2),
  replaces: z.uuid().nullable(),
});
export const agreementStateSchema = z
  .strictObject({
    collaborationId: z.uuid(),
    parties: z.tuple([z.uuid(), z.uuid()]),
    version: z.number().int().nonnegative(),
    writable: z.boolean(),
    offers: z.array(offerSchema).max(50),
    actions: z
      .array(
        z.strictObject({
          id: z.uuid(),
          fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
        }),
      )
      .max(100),
  })
  .superRefine((s, c) => {
    if (
      s.parties[0] === s.parties[1] ||
      new Set(s.offers.map((o) => o.id)).size !== s.offers.length ||
      new Set(s.actions.map((a) => a.id)).size !== s.actions.length ||
      s.offers.some(
        (o) =>
          !s.parties.includes(o.authorId) ||
          new Set(o.acceptedBy).size !== o.acceptedBy.length ||
          !o.acceptedBy.includes(o.authorId) ||
          o.acceptedBy.some((p) => !s.parties.includes(p)),
      )
    )
      c.addIssue({ code: "custom", message: "Invalid agreement history" });
  });
export type AgreementState = z.infer<typeof agreementStateSchema>;
const common = {
  id: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  actorId: z.uuid(),
  collaborationId: z.uuid(),
};
export const agreementActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...common,
    kind: z.literal("propose"),
    offerId: z.uuid(),
    terms: campaignBriefTermsStorageSchema,
  }),
  z.strictObject({ ...common, kind: z.literal("accept"), offerId: z.uuid() }),
]);
export function confirmedAgreement(state: AgreementState) {
  return state.offers.findLast((o) => o.acceptedBy.length === 2) ?? null;
}
// Run only on server-loaded history; repository CAS must persist the entire returned state atomically.
export function applyAgreementAction(input: unknown, action: unknown) {
  const state = agreementStateSchema.parse(input),
    a = agreementActionSchema.parse(action);
  if (
    a.collaborationId !== state.collaborationId ||
    !state.parties.includes(a.actorId)
  )
    throw Error("AGREEMENT_FORBIDDEN");
  const fingerprint = createHash("sha256")
      .update(JSON.stringify(a))
      .digest("hex"),
    prior = state.actions.find((x) => x.id === a.id);
  if (prior) {
    if (prior.fingerprint !== fingerprint) throw Error("AGREEMENT_KEY_REUSED");
    return state;
  }
  if (!state.writable) throw Error("AGREEMENT_LOCKED");
  if (state.version !== a.expectedVersion)
    throw Error("AGREEMENT_STALE_VERSION");
  if (
    state.actions.length >= 100 ||
    (state.offers.length >= 50 && a.kind === "propose")
  )
    throw Error("AGREEMENT_LIMIT");
  const next = structuredClone(state);
  if (a.kind === "propose") {
    if (state.offers.some((o) => o.id === a.offerId))
      throw Error("AGREEMENT_OFFER_EXISTS");
    next.offers.push({
      id: a.offerId,
      authorId: a.actorId,
      terms: a.terms,
      acceptedBy: [a.actorId],
      replaces: confirmedAgreement(state)?.id ?? null,
    });
  } else {
    const offer = next.offers.at(-1);
    if (
      !offer ||
      offer.id !== a.offerId ||
      offer.acceptedBy.includes(a.actorId)
    )
      throw Error("AGREEMENT_NOT_PENDING");
    offer.acceptedBy.push(a.actorId);
  }
  next.version++;
  next.actions.push({ id: a.id, fingerprint });
  return agreementStateSchema.parse(next);
}
