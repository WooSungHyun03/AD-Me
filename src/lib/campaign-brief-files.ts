import { z } from "zod";
export const BRIEF_BUCKET = "adme-campaign-briefs";
export const BRIEF_MAX_BYTES = 4 * 1024 * 1024;
const file = z.strictObject({
  fileId: z.uuid().nullable(),
  name: z.string().max(120).nullable(),
  mime: z.string().nullable(),
  size: z.number().int().min(1).max(BRIEF_MAX_BYTES).nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});
export const briefFilesPage = z.strictObject({
  version: z.literal(1),
  enabled: z.boolean(),
  revision: z.number().int().min(0).max(200),
  activeFile: z.uuid().nullable(),
  files: z.array(file).max(20),
  history: z
    .array(
      file.extend({
        revision: z.number().int().min(1).max(200),
        action: z.enum(["upload", "restore", "clear"]),
      }),
    )
    .max(20),
});
export type BriefFilesPage = z.infer<typeof briefFilesPage>;
export const briefFileReceipt = z.strictObject({
  revision: z.number().int().min(1).max(200),
  fileId: z.uuid().nullable(),
});
export const briefFileChange = z
  .strictObject({
    action: z.enum(["restore", "clear"]),
    fileId: z.uuid().nullable(),
    expectedVersion: z.number().int().min(0).max(199),
    clientKey: z.uuid(),
  })
  .refine((value) => (value.action === "clear") === (value.fileId === null));
