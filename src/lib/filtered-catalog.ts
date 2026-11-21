import { z } from "zod";
import { creatorFilterIssues, type CreatorFilters } from "./creator-filters";
import { publicCatalogCreatorSchema } from "./creator-public-profile";
const choices = z.array(z.string().min(1).max(50)).max(8);
const bound = z.string().regex(/^(?:|[0-9]{1,11})$/);
export const creatorFilterSchema = z
  .strictObject({
    query: z.string().max(120),
    categories: choices,
    platforms: choices,
    tags: choices,
    minPrice: bound,
    maxPrice: bound,
    minFollowers: bound,
    maxFollowers: bound,
    minEngagement: z
      .string()
      .regex(/^(?:|[0-9]{1,3})$/)
      .default(""),
    available: z.boolean(),
    sort: z.enum(["name", "price", "followers"]),
  })
  .superRefine((v, ctx) => {
    for (const message of creatorFilterIssues(v))
      ctx.addIssue({ code: "custom", message });
  });
export const filteredCatalogSchema = z.strictObject({
  version: z.literal(1),
  items: z.array(publicCatalogCreatorSchema).max(100),
  nextCursor: z.string().max(1500).nullable(),
  total: z.number().int().nonnegative(),
  facets: z.strictObject({
    categories: z.array(z.string().max(50)).max(1000),
    tags: z.array(z.string().max(50)).max(1000),
  }),
  metrics: z
    .strictObject({
      engagement: z.strictObject({
        available: z.boolean(),
        profiles: z.number().int().nonnegative(),
        unit: z.literal("percent"),
        minimumSample: z.literal(2),
        rule: z.literal("any_permissioned_non_youtube_identity"),
        definitions: z
          .array(
            z.strictObject({
              provider: z.string().max(30),
              policyVersion: z.string().max(80),
              formula: z.string().max(500),
            }),
          )
          .max(20),
      }),
      age: z.strictObject({
        available: z.literal(false),
        reason: z.literal("not_collected"),
      }),
      gender: z.strictObject({
        available: z.literal(false),
        reason: z.literal("not_collected"),
      }),
    })
    .optional(),
});
export type FilteredCatalog = z.infer<typeof filteredCatalogSchema>;
export async function readFilteredCatalog(
  db: {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>;
  },
  filters: CreatorFilters,
  includeDemo: boolean,
  cursor: string | null = null,
) {
  const f = creatorFilterSchema.parse(filters),
    { data, error } = await db.rpc("creator_filter_page", {
      p_filters: f,
      p_cursor: cursor,
      p_limit: 24,
      p_demo: includeDemo,
    });
  const result = filteredCatalogSchema.safeParse(data);
  if (error || !result.success) throw Error("검색 결과를 불러오지 못했습니다.");
  return result.data;
}
