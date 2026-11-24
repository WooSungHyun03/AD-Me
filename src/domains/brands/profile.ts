import { z } from "zod";
import { safePublicText } from "@/lib/sensitive-data";

export const brandAccountSchema = z
  .object({
    brandName: z.string().trim().min(2).max(120).refine(safePublicText),
    industry: z.string().trim().min(1).max(80).refine(safePublicText),
    introduction: z.string().trim().max(2000).refine(safePublicText),
    published: z.boolean(),
    contactName: z.string().trim().max(80),
    contactEmail: z.union([z.literal(""), z.email().max(254)]),
    contactVisibility: z.enum(["private", "collaborators"]),
    // D027 owns upload authorization. Do not accept arbitrary external logo URLs.
    logoUploadId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine(
    (input) =>
      input.contactVisibility === "private" ||
      Boolean(input.contactName && input.contactEmail),
    {
      path: ["contactVisibility"],
      message: "협업 상대에게 공유할 담당자 이름과 이메일을 입력해주세요.",
    },
  );
export type BrandAccount = z.infer<typeof brandAccountSchema>;

export type BrandPublicRow = {
  logoAvailable?: boolean;
  id: string;
  brand_name: string;
  industry: string;
  introduction: string;
  published: boolean;
};
export function publicBrandDTO(row: BrandPublicRow) {
  if (
    !row.published ||
    !safePublicText(row.brand_name) ||
    !safePublicText(row.industry) ||
    !safePublicText(row.introduction)
  )
    return null;
  return {
    version: 1 as const,
    id: row.id,
    brandName: row.brand_name,
    industry: row.industry,
    introduction: row.introduction,
    logo: row.logoAvailable
      ? { url: `/api/brands/${row.id}/logo`, mime: "image/png" }
      : null,
  };
}
