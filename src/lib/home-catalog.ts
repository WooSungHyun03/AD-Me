import { z } from "zod";
import { publicCatalogCreatorSchema } from "./creator-public-profile";
export const homeCatalogSchema = z
  .strictObject({
    version: z.literal(1),
    total: z.number().int().nonnegative(),
    demo: z.number().int().nonnegative(),
    registered: z.number().int().nonnegative(),
    asOf: z.iso.datetime({ offset: true }),
    featured: z.array(publicCatalogCreatorSchema).max(3),
  })
  .superRefine((v, ctx) => {
    if (v.total !== v.demo + v.registered || v.featured.length > v.total)
      ctx.addIssue({ code: "custom", message: "Invalid catalogue counts" });
  });
