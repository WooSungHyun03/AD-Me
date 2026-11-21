import { expect, it } from "vitest";
import { homeCatalogSchema } from "@/lib/home-catalog";
it("accepts an actual empty catalogue and distinguishes unknown read from a known zero", () => {
  expect(
    homeCatalogSchema.parse({
      version: 1,
      total: 0,
      demo: 0,
      registered: 0,
      asOf: "2026-11-21T00:00:00Z",
      featured: [],
    }).total,
  ).toBe(0);
  expect(homeCatalogSchema.safeParse(null).success).toBe(false);
});
it("rejects inconsistent statistics and private fields in public home responses", () => {
  expect(
    homeCatalogSchema.safeParse({
      version: 1,
      total: 48,
      demo: 0,
      registered: 1,
      asOf: "2026-11-21T00:00:00Z",
      featured: [],
    }).success,
  ).toBe(false);
  expect(
    homeCatalogSchema.safeParse({
      version: 1,
      total: 0,
      demo: 0,
      registered: 0,
      asOf: "2026-11-21T00:00:00Z",
      featured: [],
      owner_id: "private",
    }).success,
  ).toBe(false);
});
