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
const utcMinute = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00\.000Z$/)
  .refine(
    (value) =>
      !value.startsWith("0000-") &&
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString() === value,
    "올바른 UTC 시각을 입력해주세요.",
  );
const krw = z.number().int().min(0).max(100_000_000);
const cashRange = z
  .object({ minimumKrw: krw, maximumKrw: krw })
  .strict()
  .refine((v) => v.minimumKrw <= v.maximumKrw, {
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
      .strict()
      .optional(),
  })
  .strict()
  .refine((v) => Boolean(v.cash || v.product), {
    message: "현금 또는 제품 제공을 입력해주세요.",
  });
const deliverable = z
  .object({
    format: z.string().trim().min(1).max(80),
    quantity: z.number().int().positive().max(100),
    usageRights: z.string().trim().min(1).max(500),
    exclusivity: z.string().trim().min(1).max(500).nullable(),
  })
  .strict();

function termsSchema(time: z.ZodType<string>) {
  const window = z
    .object({ start: time, end: time })
    .strict()
    .refine((v) => v.start < v.end, {
      path: ["end"],
      message: "종료는 시작보다 늦어야 합니다.",
    });
  return z
    .object({
      version: z.literal(2),
      recruitment: window,
      production: window,
      posting: window,
      compensation: z.union([
        z.object({ mode: z.literal("unknown") }).strict(),
        declaredCompensation,
      ]),
      deliverables: z.array(deliverable).min(1).max(20),
    })
    .strict()
    .refine(
      (v) =>
        v.recruitment.start <= v.production.start &&
        v.production.start <= v.posting.start,
      {
        path: ["posting"],
        message: "모집·제작·게시의 시작일 순서를 확인해주세요.",
      },
    );
}

// Local form input and wire/storage formats are deliberately separate.
export const campaignBriefTermsSchema = termsSchema(kstDateTime);
export const campaignBriefTermsStorageSchema = termsSchema(utcMinute);
export type CampaignTerms = z.output<typeof campaignBriefTermsStorageSchema>;
export function utcToKstInput(utc: string) {
  return new Date(Date.parse(utc) + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}
export function campaignTermsFromForm(form: FormData): CampaignTerms {
  const text = (key: string) => form.get(key);
  const number = (key: string) => {
    const raw = text(key);
    return typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  };
  const mode = text("compensation_mode");
  const compensation =
    mode === "unknown"
      ? { mode: "unknown" }
      : {
          mode: "declared",
          ...(["cash", "mixed"].includes(String(mode))
            ? {
                cash: {
                  minimumKrw: number("cash_min"),
                  maximumKrw: number("cash_max"),
                },
              }
            : {}),
          ...(["product", "mixed"].includes(String(mode))
            ? {
                product: {
                  description: text("product_description"),
                  quantity: number("product_quantity"),
                },
              }
            : {}),
        };
  const formats = form.getAll("deliverable_format"),
    quantities = form.getAll("deliverable_quantity"),
    rights = form.getAll("deliverable_rights"),
    exclusivity = form.getAll("deliverable_exclusivity");
  const terms = campaignBriefTermsSchema.parse({
    version: 2,
    ...Object.fromEntries(
      ["recruitment", "production", "posting"].map((key) => [
        key,
        { start: text(`${key}_start`), end: text(`${key}_end`) },
      ]),
    ),
    compensation,
    deliverables: formats.map((format, i) => ({
      format,
      quantity: quantities[i] !== "" ? Number(quantities[i]) : NaN,
      usageRights: rights[i],
      exclusivity: exclusivity[i] === "" ? null : exclusivity[i],
    })),
  });
  return campaignBriefTermsStorageSchema.parse(terms);
}
