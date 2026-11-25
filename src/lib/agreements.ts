import { z } from "zod";

// D050: collaboration terms the two parties agree on. Plain-text deliverables/schedule; budget in KRW.
export const agreementTermsSchema = z.strictObject({
  budgetKrw: z.number().int().min(0).max(1_000_000_000).nullable(),
  deliverables: z.string().trim().min(1).max(500),
  schedule: z.string().trim().min(1).max(300),
  note: z.string().trim().max(500),
});
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;

export const agreementStateSchema = z.object({
  proposalId: z.uuid(),
  version: z.number().int().nonnegative(),
  writable: z.boolean(),
  offers: z
    .array(
      z.object({
        id: z.uuid(),
        mine: z.boolean(),
        terms: agreementTermsSchema,
        accepted: z.boolean(),
        acceptedByMe: z.boolean(),
        replaces: z.uuid().nullable(),
        createdAt: z.string(),
        confirmedAt: z.string().nullable(),
      }),
    )
    .max(50),
});
export type AgreementState = z.infer<typeof agreementStateSchema>;

export const agreementRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("propose"),
    proposalId: z.uuid(),
    offerId: z.uuid(),
    expectedVersion: z.number().int().nonnegative().max(1_000_000),
    terms: agreementTermsSchema,
  }),
  z.strictObject({
    action: z.literal("accept"),
    proposalId: z.uuid(),
    offerId: z.uuid(),
    expectedVersion: z.number().int().nonnegative().max(1_000_000),
  }),
]);

const errors: Record<string, [string, number]> = {
  stale_version: [
    "상대방의 변경이 먼저 반영되었습니다. 최신 조건을 확인한 뒤 다시 시도해주세요.",
    409,
  ],
  not_pending: ["이미 처리되었거나 최신이 아닌 조건 제안입니다.", 409],
  agreement_locked: [
    "종료되었거나 연락이 제한된 협업은 조건을 바꿀 수 없습니다.",
    409,
  ],
  key_reused: ["같은 요청 키로 다른 조건을 보낼 수 없습니다.", 409],
  agreement_limit: ["조건 제안은 협업당 50건까지 기록할 수 있습니다.", 409],
  forbidden: ["이 협업의 참여자만 조건을 확인할 수 있습니다.", 403],
};
export const agreementError = (message = "") =>
  Object.entries(errors).find(([k]) => message.includes(k))?.[1];

// Last terms both parties accepted; a newer one-sided offer never replaces them.
export const agreedTerms = (s: AgreementState) =>
  s.offers.findLast((o) => o.accepted) ?? null;
export const pendingOffer = (s: AgreementState) => {
  const last = s.offers.at(-1);
  return last && !last.accepted ? last : null;
};
