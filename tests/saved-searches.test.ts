import { expect, it } from "vitest";
import { savedSearchInput, savedSearchList } from "@/lib/saved-searches";
import { emptyCreatorFilters } from "@/lib/creator-filters";
const input = {
  id: "ad000000-0000-4000-8000-000000000301",
  expected: 0,
  name: "검색",
  filters: emptyCreatorFilters(),
};
it("requires explicit condition version on reads and disallows client ownership or alert injection", () => {
  expect(
    savedSearchInput.safeParse({ ...input, ownerId: "other" }).success,
  ).toBe(false);
  expect(
    savedSearchInput.safeParse({ ...input, notificationsEnabled: true })
      .success,
  ).toBe(false);
  expect(
    savedSearchList.safeParse([{ ...input, filterVersion: 2, revision: 1 }])
      .success,
  ).toBe(false);
});
it("rejects unsupported/corrupt/contradictory filters before DB access", () => {
  for (const filters of [
    { ...input.filters, gender: "female" },
    { ...input.filters, minFollowers: "100", maxFollowers: "5" },
    { ...input.filters, platforms: ["unknown"] },
  ])
    expect(savedSearchInput.safeParse({ ...input, filters }).success).toBe(
      false,
    );
  expect(savedSearchInput.safeParse({ ...input, expected: -1 }).success).toBe(
    false,
  );
  expect(savedSearchInput.parse(input).filters.minPrice).toBe("");
});
