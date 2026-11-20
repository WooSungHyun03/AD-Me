import { z } from "zod";
import { safeHttpsLink } from "./social-links";
const revision = z.number().int().min(0).max(2147483647);
const at = z.iso.datetime({ offset: true });
export const deliveryDeclarationSchema = z.enum(["marked", "not_applicable"]);
export const deliveryUrlSchema = z
  .string()
  .max(1000)
  .refine((v) => !!safeHttpsLink(v), "HTTPS 결과물 링크를 확인해주세요.")
  .transform((v) => safeHttpsLink(v)!.href);
export const deliveryCreateSchema = z.strictObject({
  proposalId: z.uuid(),
  expectedVersion: revision,
  clientKey: z.uuid(),
  body: z.string().trim().min(1).max(3000),
  url: deliveryUrlSchema,
  declaration: deliveryDeclarationSchema,
  confirmed: z.literal(true),
});
export const deliveryAttestSchema = z.strictObject({
  proposalId: z.uuid(),
  submissionId: z.uuid(),
  expectedVersion: revision,
  declaration: deliveryDeclarationSchema,
  confirmed: z.literal(true),
});
export const deliveryTransitionSchema = z
  .strictObject({
    id: z.uuid(),
    action: z.enum(["submitted", "revision_requested", "completed"]),
    submissionId: z.uuid(),
    expectedVersion: revision,
    clientKey: z.uuid(),
    reviewNote: z.string().trim().max(2000).default(""),
    advertisingChecked: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (
      (v.action !== "submitted" && v.reviewNote.length < 10) ||
      (v.action === "completed" && !v.advertisingChecked)
    )
      ctx.addIssue({
        code: "custom",
        path: ["reviewNote"],
        message: "10자 이상의 검토 근거와 광고 표시 확인이 필요합니다.",
      });
  });
export const deliverySubmissionSchema = z.strictObject({
  id: z.uuid(),
  version: z.number().int().positive(),
  body: z.string().min(1).max(3000),
  url: z
    .string()
    .max(1000)
    .nullable()
    .catch(null)
    .transform((v) => safeHttpsLink(v ?? undefined)?.href ?? null),
  legacy: z.boolean(),
  createdAt: at,
  attestation: z
    .strictObject({ declaration: deliveryDeclarationSchema, confirmedAt: at })
    .nullable(),
  events: z
    .array(
      z.strictObject({
        action: z.enum(["submitted", "revision_requested", "completed"]),
        note: z.string().max(2000),
        advertisingChecked: z.boolean(),
        createdAt: at,
      }),
    )
    .max(4),
});
export const deliveryPageSchema = z.strictObject({
  version: z.literal(1),
  proposalId: z.uuid(),
  status: z.enum([
    "pending",
    "accepted",
    "rejected",
    "submitted",
    "revision_requested",
    "completed",
  ]),
  roomRevision: revision,
  enforced: z.boolean(),
  legacyCompleted: z.boolean(),
  canCreate: z.boolean(),
  canAttest: z.boolean(),
  canSubmit: z.boolean(),
  canReview: z.boolean(),
  needsNewVersion: z.boolean(),
  active: deliverySubmissionSchema.nullable(),
  items: z.array(deliverySubmissionSchema).max(50),
  nextVersion: z.number().int().positive().nullable(),
});
export const deliveryTransitionResultSchema = z.strictObject({
  status: z.enum(["submitted", "revision_requested", "completed"]),
  roomRevision: revision,
});
export type DeliveryPage = z.infer<typeof deliveryPageSchema>;
