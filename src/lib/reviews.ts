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
]);
const at = z.iso.datetime({ offset: true });
export const reviewCaseSchema = z.strictObject({
  id: z.uuid(),
  kind: z.literal("issue"),
  creatorId: z.string().min(1).max(100),
  version: z.number().int().positive(),
  status: z.enum(["pending", "approved", "rejected", "withdrawn"]),
  publicVisible: z.boolean(),
  isDemo: z.boolean(),
  createdAt: at,
  canRevise: z.boolean(),
  canRespond: z.boolean(),
  canReview: z.boolean(),
  payload: issuePayloadSchema,
  history: z.array(
    z.strictObject({
      version: z.number().int().positive(),
      payload: issuePayloadSchema,
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
export const reviewActionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("revise"),
    id: z.uuid(),
    expectedVersion: z.number().int().positive(),
    payload: issuePayloadSchema,
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
