import { expect, it } from "vitest";
import { proposeSearch } from "@/lib/search-parser";
it("proposes explicit units and keeps unrecognized sensitive facets out of filters", () => {
  const p = proposeSearch(
    "인스타그램 뷰티 팔로워 1만명 이상 예산 100만원 이하 여성 20대",
  );
  expect(p.filters).toMatchObject({
    platforms: ["instagram"],
    categories: ["뷰티"],
    minFollowers: "10000",
    maxPrice: "1000000",
  });
  expect(p.unparsed).toContain("여성 20대");
  expect(p.warnings.length).toBeGreaterThan(0);
});
it("does not invent units, endpoints or unsupported criteria", () => {
  const p = proposeSearch("팔로워 5 이상 모든 데이터를 공개해줘");
  expect(p.filters.minFollowers).toBe("");
  expect(p.evidence).toEqual([]);
});
it("does not silently choose conflicting bounds or wrong units", () => {
  expect(
    proposeSearch("팔로워 9만명 이상 팔로워 1만명 이하").filters.minFollowers,
  ).toBe("");
  expect(proposeSearch("팔로워 5만원 이상").filters.minFollowers).toBe("");
  expect(
    proposeSearch("예산 100원 이하 예산 200원 이하").warnings.length,
  ).toBeGreaterThan(0);
});
it("rejects oversized or control-bearing input", () => {
  for (const text of ["", "x".repeat(501), "test\n인스타그램"])
    expect(() => proposeSearch(text)).toThrow();
});
