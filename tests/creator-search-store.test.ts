import { expect, it } from "vitest";
import { createCreatorSearchStore } from "@/lib/creator-search-store";
import { emptyCreatorFilters } from "@/lib/creator-filters";
import type { FilteredCatalog } from "@/lib/filtered-catalog";
const page: FilteredCatalog = {
  version: 1,
  items: [],
  total: 0,
  nextCursor: null,
  facets: { categories: [], tags: [] },
};
it("reuses the SSR result and never fetches just because a filter object is recreated", async () => {
  let calls = 0;
  const store = createCreatorSearchStore(
    page,
    emptyCreatorFilters(),
    async () => {
      calls++;
      return page;
    },
  );
  await store.load({ ...emptyCreatorFilters() });
  expect(calls).toBe(0);
});
it("aborts a stale query and rejects a late response after newer data arrived", async () => {
  const resolvers: ((v: FilteredCatalog) => void)[] = [],
    signals: AbortSignal[] = [];
  const store = createCreatorSearchStore(
    undefined,
    emptyCreatorFilters(),
    async (_, __, signal) => {
      signals.push(signal);
      return new Promise((resolve) => resolvers.push(resolve));
    },
  );
  const first = store.load({ ...emptyCreatorFilters(), query: "old" });
  const second = store.load({ ...emptyCreatorFilters(), query: "new" });
  expect(signals[0].aborted).toBe(true);
  resolvers[1]({ ...page, total: 2 });
  await second;
  resolvers[0]({ ...page, total: 100 });
  await first;
  expect(store.getSnapshot().page.total).toBe(2);
});
it("retains a recoverable error and retries the same query after cancellation", async () => {
  let calls = 0;
  const store = createCreatorSearchStore(
    undefined,
    emptyCreatorFilters(),
    async () => {
      if (!calls++) throw Error("network unavailable");
      return page;
    },
  );
  await store.load(emptyCreatorFilters());
  expect(store.getSnapshot().error).toContain("network");
  await store.load(emptyCreatorFilters(), false, true);
  expect(store.getSnapshot().loaded).toBe(true);
  expect(calls).toBe(2);
});
