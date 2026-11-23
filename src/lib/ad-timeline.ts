import { z } from "zod";
import { publicAdReviewSchema } from "./reviews";
export const adFilterSchema = z
  .strictObject({
    creatorId: z.string().min(1).max(100),
    brand: z.string().trim().max(100).default(""),
    category: z.string().trim().max(50).default(""),
    from: z.union([z.iso.date(), z.literal("")]).default(""),
    to: z.union([z.iso.date(), z.literal("")]).default(""),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to);
export const adCursorSchema = z.strictObject({
  filter: z.strictObject({
    creator: z.string().min(1).max(100),
    brand: z.string().max(100),
    category: z.string().max(50),
    from: z.iso.date().nullable(),
    to: z.iso.date().nullable(),
  }),
  date: z.iso.date(),
  id: z.uuid(),
});
export const adPageSchema = z.strictObject({
  version: z.literal(1),
  items: z
    .array(
      z.strictObject({ record: publicAdReviewSchema, competitor: z.boolean() }),
    )
    .max(50),
  total: z.number().int().nonnegative(),
  nextCursor: adCursorSchema.nullable(),
});
export const competitorSchema = z
  .array(
    z
      .string()
      .trim()
      .min(2)
      .max(100)
      .refine((s) => !/[\u0000-\u001f\u007f]/.test(s)),
  )
  .max(20);
export function adPageArgs(
  filters: z.infer<typeof adFilterSchema>,
  cursor: unknown = null,
) {
  const f = adFilterSchema.parse(filters);
  return {
    p_creator: f.creatorId,
    p_brand: f.brand,
    p_category: f.category,
    p_from: f.from || null,
    p_to: f.to || null,
    p_after: cursor === null ? null : adCursorSchema.parse(cursor),
    p_limit: 20,
  };
}
