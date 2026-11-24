import { z } from "zod";
import { safeHttpsLink } from "@/lib/social-links";
export const messageInputSchema = z
  .object({
    proposalId: z.uuid(),
    clientKey: z.uuid().optional(),
    body: z.string().trim().min(1).max(3000),
    kind: z.enum(["message", "deliverable"]),
    url: z.string().max(1000).optional(),
  })
  .superRefine((v, ctx) => {
    if (
      (v.kind === "deliverable" && !v.url) ||
      (v.url && !safeHttpsLink(v.url))
    )
      ctx.addIssue({
        code: "custom",
        path: ["url"],
        message: "안전한 HTTPS 링크가 필요합니다.",
      });
  });
export const messageRowSchema = z.strictObject({
  id: z.uuid(),
  senderId: z.uuid(),
  body: z.string().min(1).max(3000),
  kind: z.enum(["message", "deliverable"]),
  // Legacy optional URLs are sanitized when displayed, not trusted as markup.
  url: z
    .string()
    .max(1000)
    .nullable()
    .catch(null)
    .transform((value) => (value && safeHttpsLink(value) ? value : null)),
  createdAt: z.iso.datetime({ offset: true }),
});
export const cursorPointSchema = z.strictObject({
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
export const conversationPageSchema = z.strictObject({
  version: z.literal(1),
  items: z.array(messageRowSchema).max(50),
  nextCursor: z.string().min(1).max(512).nullable(),
  blocked: z.boolean(),
  blockedByMe: z.boolean(),
});
export type ConversationMessage = z.infer<typeof messageRowSchema>;
