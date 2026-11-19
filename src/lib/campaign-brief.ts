import { z } from "zod";

const kstDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .transform((local, context) => {
    const timestamp = Date.parse(`${local}:00+09:00`);
    const roundTrip = Number.isFinite(timestamp)
      ? new Date(timestamp + 9 * 60 * 60 * 1000).toISOString().slice(0, 16)
      : null;
    if (roundTrip !== local) {
      context.addIssue({
        code: "custom",
        message: "올바른 대한민국 표준시를 입력해주세요.",
      });
      return z.NEVER;
    }
    return new Date(timestamp).toISOString();
  });

const windowSchema = z
  .object({ start: kstDateTime, end: kstDateTime })
  .refine(({ start, end }) => start < end, {
    path: ["end"],
    message: "종료는 시작보다 늦어야 합니다.",
  });
const krw = z.number().int().min(0).max(100_000_000);

const cashRange = z
  .object({ minimumKrw: krw, maximumKrw: krw })
  .refine(({ minimumKrw, maximumKrw }) => minimumKrw <= maximumKrw, {
    path: ["maximumKrw"],
    message: "최대 단가는 최소 단가 이상이어야 합니다.",
  });

const declaredCompensation = z
  .object({
    mode: z.literal("declared"),
    cash: cashRange.optional(),
    product: z
      .object({
        description: z.string().trim().min(1).max(300),
        quantity: z.number().int().positive().max(1000),
      })
      .optional(),
  })
  .refine(({ cash, product }) => Boolean(cash || product), {
    message: "현금 또는 제품 제공을 입력해주세요.",
  });

export const campaignBriefTermsSchema = z
  .object({
    version: z.literal(2),
    recruitment: windowSchema,
    production: windowSchema,
    posting: windowSchema,
    compensation: z.union([
      z.object({ mode: z.literal("unknown") }).strict(),
      declaredCompensation,
    ]),
    deliverables: z
      .array(
        z.object({
          format: z.string().trim().min(1).max(80),
          quantity: z.number().int().positive().max(100),
          usageRights: z.string().trim().min(1).max(500),
          exclusivity: z.string().trim().max(500).nullable(),
        }),
      )
      .min(1)
      .max(20),
  })
  .refine(
    ({ recruitment, production, posting }) =>
      recruitment.start <= production.start &&
      production.start <= posting.start,
    {
      path: ["posting"],
      message: "모집·제작·게시의 시작일 순서를 확인해주세요.",
    },
  );
