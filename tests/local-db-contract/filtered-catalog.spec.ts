import { expect, it } from "vitest";
import { localRuntime, localClient } from "../support/local-qa.mjs";
import { readPublicCreatorCatalog } from "@/lib/creator-catalog-read";
import { readFilteredCatalog } from "@/lib/filtered-catalog";
import {
  emptyCreatorFilters,
  filterCreators,
  type CreatorFilters,
} from "@/lib/creator-filters";
it("actual SQL OR/AND filters and Korean/numeric tie sorts match the previous client contract", async () => {
  localRuntime();
  const db = localClient(),
    all = await readPublicCreatorCatalog(db);
  const cases: CreatorFilters[] = [
    emptyCreatorFilters(),
    {
      ...emptyCreatorFilters(),
      platforms: ["youtube", "instagram"],
      categories: ["뷰티", "테크"],
      tags: ["자연스러움"],
    },
    {
      ...emptyCreatorFilters(),
      minPrice: "0",
      maxPrice: "500000",
      sort: "price",
    },
    {
      ...emptyCreatorFilters(),
      minFollowers: "0",
      maxFollowers: "10000000000",
      sort: "followers",
    },
    { ...emptyCreatorFilters(), available: true, query: "%" },
  ];
  for (const filters of cases) {
    const page = await readFilteredCatalog(db, filters, true);
    const expected = filterCreators(all, filters);
    expect(page.total).toBe(expected.length);
    expect(page.items.map((c) => c.seed_id)).toEqual(
      expected.slice(0, 24).map((c) => c.seed_id),
    );
  }
});
