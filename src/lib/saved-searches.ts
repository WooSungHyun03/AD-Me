import { z } from "zod";
import { creatorFilterSchema } from "./filtered-catalog";
export const savedSearchInput = z.strictObject({
  id: z.uuid(),
  expected: z.number().int().min(0).max(2147483646),
  name: z.string().trim().min(1).max(80),
  filters: creatorFilterSchema,
});
export const savedSearchDelete = savedSearchInput.pick({
  id: true,
  expected: true,
});
// Opt-in for in-app new-candidate alerts is its own revisioned call, never part of a condition save.
export const savedSearchAlerts = savedSearchInput
  .pick({ id: true, expected: true })
  .extend({ notify: z.boolean() });
export const savedSearchList = z
  .array(
    z.strictObject({
      id: z.uuid(),
      name: z.string().min(1).max(80),
      filterVersion: z.literal(1),
      filters: creatorFilterSchema,
      revision: z.number().int().positive(),
      notify: z.boolean(),
    }),
  )
  .max(20);
