import type { Creator } from "./catalog";
import { creatorPlatforms } from "./service-catalog";

export type CreatorFilters = {
  query: string;
  categories: string[];
  platforms: string[];
  tags: string[];
  minPrice: string;
  maxPrice: string;
  minFollowers: string;
  maxFollowers: string;
  minEngagement?: string;
  available: boolean;
  sort: "name" | "followers" | "price";
};
export const creatorFilterKeys = [
  "q",
  "category",
  "platform",
  "tag",
  "minPrice",
  "maxPrice",
  "minFollowers",
  "maxFollowers",
  "minEngagement",
  "available",
  "sort",
] as const;
export const emptyCreatorFilters = (): CreatorFilters => ({
  query: "",
  categories: [],
  platforms: [],
  tags: [],
  minPrice: "",
  maxPrice: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  available: false,
  sort: "name",
});
const boundedText = (value: string, length: number) =>
  value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, length);
const choices = (list: string[]) =>
  [
    ...new Set(
      list
        .slice(0, 64)
        .map((s) => boundedText(s, 50).trim())
        .filter(Boolean),
    ),
  ]
    .sort()
    .slice(0, 8);
const values = (params: URLSearchParams, key: string) =>
  choices(params.getAll(key));

// Version 1 URL contract: repeated values mean OR, different fields mean AND.
// Numeric strings preserve blank versus explicit zero and invalid ranges for UI correction.
export function parseCreatorFilters(params: URLSearchParams): CreatorFilters {
  const sort = params.get("sort");
  return {
    query: boundedText(params.get("q") ?? "", 120),
    categories: values(params, "category"),
    platforms: values(params, "platform"),
    tags: values(params, "tag"),
    minPrice: boundedText(params.get("minPrice") ?? "", 24),
    maxPrice: boundedText(params.get("maxPrice") ?? "", 24),
    minFollowers: boundedText(params.get("minFollowers") ?? "", 24),
    maxFollowers: boundedText(params.get("maxFollowers") ?? "", 24),
    minEngagement: boundedText(params.get("minEngagement") ?? "", 24),
    available: params.get("available") === "1",
    sort: sort === "price" || sort === "followers" ? sort : "name",
  };
}

export function serializeCreatorFilters(
  filters: CreatorFilters,
  existing = new URLSearchParams(),
) {
  const params = new URLSearchParams(existing);
  for (const key of creatorFilterKeys) params.delete(key);
  if (filters.query) params.set("q", boundedText(filters.query, 120));
  for (const [key, list] of [
    ["category", filters.categories],
    ["platform", filters.platforms],
    ["tag", filters.tags],
  ] as const)
    for (const value of choices(list)) params.append(key, value);
  for (const key of [
    "minPrice",
    "maxPrice",
    "minFollowers",
    "maxFollowers",
  ] as const)
    if (filters[key] !== "") params.set(key, filters[key]);
  if (filters.available) params.set("available", "1");
  if (filters.minEngagement) params.set("minEngagement", filters.minEngagement);
  if (filters.sort !== "name") params.set("sort", filters.sort);
  return params;
}

const bounds = {
  minPrice: 100_000_000,
  maxPrice: 100_000_000,
  minFollowers: 10_000_000_000,
  maxFollowers: 10_000_000_000,
} as const;
const labels = {
  minPrice: "최소 예산",
  maxPrice: "최대 예산",
  minFollowers: "최소 팔로워",
  maxFollowers: "최대 팔로워",
} as const;
export function creatorFilterIssues(filters: CreatorFilters) {
  const issues: string[] = [];
  if (
    filters.minEngagement &&
    (!/^[0-9]{1,3}$/.test(filters.minEngagement) ||
      Number(filters.minEngagement) > 100)
  )
    issues.push("최소 참여율은 0~100 사이 정수로 입력해주세요.");
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const text = filters[key];
    if (text !== "" && (!/^\d{1,11}$/.test(text) || Number(text) > bounds[key]))
      issues.push(
        `${labels[key]}는 0~${bounds[key].toLocaleString("ko-KR")} 사이의 정수로 입력해주세요.`,
      );
  }
  if (!issues.length) {
    if (
      filters.minPrice !== "" &&
      filters.maxPrice !== "" &&
      Number(filters.minPrice) > Number(filters.maxPrice)
    )
      issues.push("최소 예산은 최대 예산 이하여야 합니다.");
    if (
      filters.minFollowers !== "" &&
      filters.maxFollowers !== "" &&
      Number(filters.minFollowers) > Number(filters.maxFollowers)
    )
      issues.push("최소 팔로워는 최대 팔로워 이하여야 합니다.");
  }
  if (
    filters.platforms.some(
      (p) => !creatorPlatforms.some((known) => known === p),
    )
  )
    issues.push(
      "지원하지 않는 플랫폼 조건입니다. 필터를 초기화하거나 수정해주세요.",
    );
  return issues;
}

type FilterItem = Omit<Creator, "followers" | "owner_id" | "owner_consent"> & {
  followers: number | null;
};
const finiteNonnegative = (value: number | null) =>
  value !== null && Number.isFinite(value) && value >= 0;

// Legacy owner registration writes a placeholder 0 with metrics_source=unavailable.
// Until D018's public read switch, only explicitly fictional fixture counts are available.
export function catalogFollowerValue(
  item: Pick<FilterItem, "is_demo" | "followers" | "metrics_source">,
): number | null {
  return item.is_demo &&
    item.metrics_source === "synthetic_demo_not_verified" &&
    finiteNonnegative(item.followers)
    ? item.followers
    : null;
}

export function filterCreators<T extends FilterItem>(
  items: readonly T[],
  filters: CreatorFilters,
): T[] {
  if (creatorFilterIssues(filters).length) return [];
  const query = filters.query
    .trim()
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR");
  const list = items.filter((c) => {
    if (filters.minEngagement !== undefined && filters.minEngagement !== "")
      return false; // Keyless fixtures have no permissioned metric evidence.
    const followers = catalogFollowerValue(c);
    return (
      (!query ||
        `${c.name} ${c.handle} ${c.vibes.join(" ")} ${c.bio}`
          .normalize("NFKC")
          .toLocaleLowerCase("ko-KR")
          .includes(query)) &&
      (!filters.categories.length ||
        filters.categories.some((v) => c.categories.includes(v))) &&
      (!filters.platforms.length ||
        filters.platforms.some((v) => c.platforms.includes(v))) &&
      (!filters.tags.length || filters.tags.some((v) => c.vibes.includes(v))) &&
      (!filters.available || c.is_available) &&
      (filters.maxPrice === "" ||
        (finiteNonnegative(c.price_min_krw) &&
          c.price_min_krw <= Number(filters.maxPrice))) &&
      (filters.minPrice === "" ||
        (finiteNonnegative(c.price_max_krw) &&
          c.price_max_krw >= Number(filters.minPrice))) &&
      (filters.minFollowers === "" ||
        (followers !== null && followers >= Number(filters.minFollowers))) &&
      (filters.maxFollowers === "" ||
        (followers !== null && followers <= Number(filters.maxFollowers)))
    );
  });
  return list.sort((a, b) => {
    let numeric = 0;
    if (filters.sort === "followers") {
      const av = catalogFollowerValue(a),
        bv = catalogFollowerValue(b);
      numeric =
        av === null ? (bv === null ? 0 : 1) : bv === null ? -1 : bv - av;
    } else if (filters.sort === "price") {
      numeric = a.price_min_krw - b.price_min_krw;
    }
    return (
      numeric ||
      a.name.localeCompare(b.name, "ko-KR") ||
      (a.seed_id < b.seed_id ? -1 : a.seed_id > b.seed_id ? 1 : 0)
    );
  });
}
