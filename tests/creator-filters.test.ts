import { describe, expect, it } from "vitest";
import { creators } from "@/lib/catalog";
import {
  catalogFollowerValue,
  creatorFilterIssues,
  emptyCreatorFilters,
  filterCreators,
  parseCreatorFilters,
  serializeCreatorFilters,
} from "@/lib/creator-filters";

const fixture = (id: string, patch = {}) => ({
  ...creators[0],
  seed_id: id,
  ...patch,
});
const parse = (query: string) =>
  parseCreatorFilters(new URLSearchParams(query));

describe("creator filter URL contract v1", () => {
  it("roundtrips repeated OR groups, explicit zero, availability and sort without losing unrelated parameters", () => {
    const filters = parse(
      "category=뷰티&category=테크&category=뷰티&platform=youtube&platform=instagram&tag=자연스러움&minPrice=0&maxPrice=300000&minFollowers=0&maxFollowers=10000&available=1&sort=price&q=브랜드+취향",
    );
    const result = serializeCreatorFilters(
      filters,
      new URLSearchParams("utm_source=review&category=old&sort=followers"),
    );
    expect(parseCreatorFilters(result)).toEqual(filters);
    expect(result.getAll("category")).toEqual(["뷰티", "테크"]);
    expect(result.get("minPrice")).toBe("0");
    expect(result.get("utm_source")).toBe("review");
    expect(serializeCreatorFilters(filters).toString()).toBe(
      serializeCreatorFilters(parseCreatorFilters(result)).toString(),
    );
  });
  it("resets every owned field including sort and leaves unrelated query fields", () => {
    const result = serializeCreatorFilters(
      emptyCreatorFilters(),
      new URLSearchParams(
        "q=x&sort=price&category=뷰티&available=1&utm_source=review",
      ),
    );
    expect(result.toString()).toBe("utm_source=review");
  });
  it("bounds text/choice input, deduplicates and rejects an unknown platform instead of broadening results", () => {
    const filters = parse(
      `q=${"a".repeat(500)}&${Array.from({ length: 100 }, (_, n) => `category=${n}`).join("&")}&platform=not-supported&sort=arbitrary`,
    );
    expect(filters.query.length).toBe(120);
    expect(filters.categories.length).toBe(8);
    expect(filters.sort).toBe("name");
    expect(creatorFilterIssues(filters)).toHaveLength(1);
    expect(filterCreators(creators, filters)).toEqual([]);
  });
  it.each([
    "-1",
    "1.5",
    "Infinity",
    "1e9",
    "NaN",
    "100000001",
    "0000000000000000",
  ])(
    "retains invalid price %s for correction and yields no misleading results",
    (raw) => {
      const filters = parse(`maxPrice=${raw}`);
      expect(filters.maxPrice).toBe(raw);
      expect(creatorFilterIssues(filters).length).toBeGreaterThan(0);
      expect(filterCreators(creators, filters)).toEqual([]);
      expect(
        parseCreatorFilters(serializeCreatorFilters(filters)).maxPrice,
      ).toBe(raw);
    },
  );
  it("accepts inclusive maximums and zero but reports reversed price and follower ranges", () => {
    expect(
      creatorFilterIssues(
        parse(
          "minPrice=0&maxPrice=100000000&minFollowers=0&maxFollowers=10000000000",
        ),
      ),
    ).toEqual([]);
    expect(creatorFilterIssues(parse("minPrice=2&maxPrice=1"))).toContain(
      "최소 예산은 최대 예산 이하여야 합니다.",
    );
    expect(
      creatorFilterIssues(parse("minFollowers=2&maxFollowers=1")),
    ).toContain("최소 팔로워는 최대 팔로워 이하여야 합니다.");
  });
});

describe("creator snapshot filtering", () => {
  it("uses OR within each field, AND across fields and inclusive quote overlap", () => {
    const rows = [
      fixture("a", {
        categories: ["뷰티"],
        platforms: ["youtube"],
        vibes: ["차분함"],
        is_available: true,
        price_min_krw: 100,
        price_max_krw: 300,
        followers: 0,
      }),
      fixture("b", {
        categories: ["테크"],
        platforms: ["instagram"],
        vibes: ["자연스러움"],
        is_available: true,
        price_min_krw: 200,
        price_max_krw: 400,
        followers: 10,
      }),
      fixture("c", {
        categories: ["뷰티"],
        platforms: ["tiktok"],
        vibes: ["차분함"],
        is_available: true,
        price_min_krw: 0,
        price_max_krw: 100,
        followers: 0,
      }),
      fixture("d", {
        categories: ["뷰티"],
        platforms: ["youtube"],
        vibes: ["차분함"],
        is_available: false,
        price_min_krw: 100,
        price_max_krw: 300,
        followers: 0,
      }),
    ];
    const filters = parse(
      "category=뷰티&category=테크&platform=youtube&platform=instagram&tag=차분함&tag=자연스러움&minPrice=300&maxPrice=300&minFollowers=0&maxFollowers=10&available=1",
    );
    expect(filterCreators(rows, filters).map((r) => r.seed_id)).toEqual([
      "a",
      "b",
    ]);
  });
  it("distinguishes numeric zero from missing/null/placeholder values for filtering and sorting", () => {
    const zero = fixture("zero", { followers: 0 });
    const missing = fixture("missing", { followers: null });
    const unavailableDemo = fixture("unavailable-demo", {
      followers: 0,
      metrics_source: "unavailable",
    });
    const ownerPlaceholder = fixture("owner", {
      is_demo: false,
      followers: 0,
      metrics_source: "unavailable",
    });
    const fakeOwnerCount = fixture("not-a-real-observation", {
      is_demo: false,
      followers: 99999,
    });
    expect(catalogFollowerValue(zero)).toBe(0);
    for (const item of [
      missing,
      unavailableDemo,
      ownerPlaceholder,
      fakeOwnerCount,
    ])
      expect(catalogFollowerValue(item)).toBeNull();
    const rows = [
      missing,
      unavailableDemo,
      ownerPlaceholder,
      fakeOwnerCount,
      zero,
    ];
    expect(
      filterCreators(rows, parse("minFollowers=0&maxFollowers=0")).map(
        (r) => r.seed_id,
      ),
    ).toEqual(["zero"]);
    expect(filterCreators(rows, parse("sort=followers"))[0].seed_id).toBe(
      "zero",
    );
    expect(filterCreators(rows, parse(""))).toHaveLength(5);
  });
  it("zero budget is an actual upper bound; missing observations never become legacy follower values", () => {
    const rows = [
      fixture("free", { price_min_krw: 0, price_max_krw: 0 }),
      fixture("paid", { price_min_krw: 1, price_max_krw: 2 }),
    ];
    expect(
      filterCreators(rows, parse("maxPrice=0")).map((r) => r.seed_id),
    ).toEqual(["free"]);
  });
  it("has stable ID tie breaks for equal names/numbers and does not mutate the source", () => {
    const rows = [fixture("b"), fixture("a")];
    for (const sort of ["name", "price", "followers"])
      expect(
        filterCreators(rows, parse(`sort=${sort}`)).map((r) => r.seed_id),
      ).toEqual(["a", "b"]);
    expect(rows.map((r) => r.seed_id)).toEqual(["b", "a"]);
  });
  it("searches normalized Korean/handles and handles empty results without stale state", () => {
    expect(filterCreators(creators, parse("q=서하린"))).toHaveLength(1);
    expect(filterCreators(creators, parse("q=결과없는검색"))).toEqual([]);
    expect(filterCreators(creators, emptyCreatorFilters())).toHaveLength(48);
  });
});
