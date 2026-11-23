import { z } from "zod";
import { safeHttpsLink } from "./social-links";
export const evidenceKinds = [
  "claim",
  "source",
  "official_statement",
  "correction",
] as const;
export const reviewSourceSchema = z
  .string()
  .max(1000)
  .refine((s) => !!safeHttpsLink(s), "HTTPS 공개 출처가 필요합니다.")
  .transform((s) => safeHttpsLink(s)!.href);
export const issuePayloadSchema = z.strictObject({
  reason: z.string().trim().min(10).max(2000),
  sourceUrl: reviewSourceSchema,
  evidenceKind: z.enum(evidenceKinds),
});
export const reviewClassificationSchema = z.enum([
  "unverified_claim",
  "confirmed_fact",
  "official_correction",
  "ad_evidence",
]);
export const adEvidenceKinds = [
  "self_declaration",
  "paid_partnership_label",
  "official_confirmation",
  "brand_mention",
] as const;
export const adInterestLabels = {
  paid: "금전 대가",
  gifted: "제품·서비스 제공",
  affiliate: "제휴 수익",
  unpaid: "대가 없음",
  unknown: "미확인",
} as const;
export const adDisclosureLabels = {
  visible: "표시 확인",
  missing: "표시 미확인·없음",
  unclear: "판단 불가",
} as const;
const adFields = {
  brandLabel: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(50),
  format: z.string().trim().min(2).max(50),
  startedOn: z.iso.date(),
  endedOn: z.iso.date(),
  interest: z.enum(["paid", "gifted", "affiliate", "unpaid", "unknown"]),
  disclosure: z.enum(["visible", "missing", "unclear"]),
  evidenceKind: z.enum(adEvidenceKinds),
  sourceUrl: reviewSourceSchema,
};
export const adPayloadSchema = z
  .strictObject({ ...adFields, ownershipConfirmed: z.literal(true) })
  .refine((v) => v.startedOn <= v.endedOn, {
    path: ["endedOn"],
    message: "기간을 확인해주세요.",
  });
export const publicAdPayloadSchema = z
  .strictObject(adFields)
  .refine((v) => v.startedOn <= v.endedOn);
export const reviewPayloadSchema = z.union([
  issuePayloadSchema,
  adPayloadSchema,
]);
const at = z.iso.datetime({ offset: true });
export const reviewCaseSchema = z
  .strictObject({
    id: z.uuid(),
    kind: z.enum(["issue", "ad"]),
    creatorId: z.string().min(1).max(100),
    version: z.number().int().positive(),
    status: z.enum(["pending", "approved", "rejected", "withdrawn"]),
    publicVisible: z.boolean(),
    isDemo: z.boolean(),
    createdAt: at,
    canRevise: z.boolean(),
    canRespond: z.boolean(),
    canReview: z.boolean(),
    payload: reviewPayloadSchema,
    history: z.array(
      z.strictObject({
        version: z.number().int().positive(),
        payload: reviewPayloadSchema,
        createdAt: at,
      }),
    ),
    responses: z.array(
      z.strictObject({
        version: z.number().int().positive(),
        body: z.string().max(2000),
        sourceUrl: reviewSourceSchema.nullable(),
        publishConsent: z.boolean(),
        createdAt: at,
      }),
    ),
    decisions: z.array(
      z.strictObject({
        version: z.number().int().positive(),
        classification: reviewClassificationSchema,
        verdict: z.enum(["approved", "rejected"]),
        summary: z.string().max(1000),
        note: z.string().max(2000).nullable(),
        reviewedAt: at,
      }),
    ),
  })
  .superRefine((v, ctx) => {
    if (
      (v.kind === "issue") !== "reason" in v.payload ||
      v.history.some((h) => (v.kind === "issue") !== "reason" in h.payload)
    )
      ctx.addIssue({
        code: "custom",
        message: "검토 자료 종류가 일치하지 않습니다.",
      });
  });
export const reviewCursorSchema = z.strictObject({
  createdAt: at,
  id: z.uuid(),
});
export const reviewInboxSchema = z.strictObject({
  items: z.array(reviewCaseSchema).max(50),
  nextCursor: reviewCursorSchema.nullable(),
});
export const publicReviewSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  kind: z.literal("issue"),
  isDemo: z.boolean(),
  payload: z.strictObject({
    sourceUrl: reviewSourceSchema,
    evidenceKind: z.enum(evidenceKinds),
  }),
  classification: z.enum(["confirmed_fact", "official_correction"]),
  summary: z.string().min(10).max(1000),
  reviewedAt: at,
  policyVersion: z.string().min(1).max(80),
  response: z
    .strictObject({
      body: z.string().max(2000),
      sourceUrl: reviewSourceSchema.nullable(),
      createdAt: at,
    })
    .nullable(),
});
export type ReviewCase = z.infer<typeof reviewCaseSchema>;
export const publicAdReviewSchema = publicReviewSchema
  .omit({ kind: true, payload: true, classification: true })
  .extend({
    kind: z.literal("ad"),
    payload: publicAdPayloadSchema,
    classification: z.literal("ad_evidence"),
  })
  .superRefine((v, ctx) => {
    if (
      !["paid_partnership_label", "official_confirmation"].includes(
        v.payload.evidenceKind,
      ) ||
      v.payload.interest === "unknown"
    )
      ctx.addIssue({
        code: "custom",
        message: "확인 가능한 광고 근거가 필요합니다.",
      });
  });
export const reviewActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("revise"),
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    payload: reviewPayloadSchema,
  }),
  z.strictObject({
    action: z.literal("respond"),
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    body: z.string().trim().min(10).max(2000),
    sourceUrl: reviewSourceSchema.nullable(),
    publishConsent: z.boolean(),
  }),
  z.strictObject({
    action: z.literal("withdraw"),
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
  }),
]);
export const reviewDecisionSchema = z
  .strictObject({
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    verdict: z.enum(["approved", "rejected"]),
    classification: reviewClassificationSchema,
    note: z.string().trim().min(10).max(2000),
    summary: z.string().trim().max(1000),
    publish: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (
      v.publish &&
      (v.verdict !== "approved" ||
        v.classification === "unverified_claim" ||
        v.summary.length < 10)
    )
      ctx.addIssue({
        code: "custom",
        path: ["publish"],
        message: "미확인 주장은 공개할 수 없습니다.",
      });
  });
