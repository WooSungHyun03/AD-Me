import {
  serializeCreatorFilters,
  type CreatorFilters,
} from "./creator-filters";
import {
  filteredCatalogSchema,
  type FilteredCatalog,
} from "./filtered-catalog";
import { createLatestCreatorSearch } from "./creator-search-request";
const empty: FilteredCatalog = {
  version: 1,
  items: [],
  nextCursor: null,
  total: 0,
  facets: { categories: [], tags: [] },
};
export function createCreatorSearchStore(
  initial: FilteredCatalog | undefined,
  filters: CreatorFilters,
  request = async (
    f: CreatorFilters,
    cursor: string | null,
    signal: AbortSignal,
  ) => {
    const q = serializeCreatorFilters(f);
    if (cursor) q.set("cursor", cursor);
    const response = await fetch(`/api/creators/search?${q}`, {
      signal,
      cache: "no-store",
    });
    if (!response.ok)
      throw Error("검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
    return filteredCatalogSchema.parse(await response.json());
  },
) {
  let state = {
    page: initial ?? empty,
    key: serializeCreatorFilters(filters).toString(),
    loading: false,
    error: "",
    loaded: !!initial,
  };
  const subscribers = new Set<() => void>(),
    latest = createLatestCreatorSearch<FilteredCatalog>();
  const emit = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
    subscribers.forEach((f) => f());
  };
  return {
    subscribe: (fn: () => void) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    getSnapshot: () => state,
    cancel: () => {
      latest.cancel();
      if (state.loading) emit({ loading: false, loaded: false });
    },
    async load(f: CreatorFilters, more = false, force = false) {
      const key = serializeCreatorFilters(f).toString();
      if (
        !force &&
        !more &&
        state.key === key &&
        (state.loaded || state.loading)
      )
        return;
      const prior = state.page,
        cursor = more && state.key === key ? prior.nextCursor : null;
      if (more && !cursor) return;
      emit({
        key,
        loading: true,
        error: "",
        loaded: false,
        page: more ? prior : { ...empty, facets: prior.facets },
      });
      try {
        const result = await latest.run(f, (query, signal) =>
          request(query, cursor, signal),
        );
        if (result.kind === "stale") return;
        const page = result.value;
        if (cursor && page.nextCursor === cursor)
          throw Error("검색 순서를 확인하지 못했습니다. 다시 검색해주세요.");
        const items = cursor ? [...prior.items, ...page.items] : page.items;
        if (new Set(items.map((c) => c.seed_id)).size !== items.length)
          throw Error("검색 데이터가 변경되었습니다. 다시 검색해주세요.");
        emit({ page: { ...page, items }, loading: false, loaded: true });
      } catch (error) {
        emit({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "검색을 불러오지 못했습니다.",
          loaded: false,
        });
      }
    },
  };
}
