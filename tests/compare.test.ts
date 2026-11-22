import { expect, it } from "vitest";
import { creators, type Creator } from "@/lib/catalog";
import { COMPARE_ROWS, compareCsv, parseIds } from "@/lib/compare";
import { parseCsv } from "@/lib/csv";
const demo = creators as unknown as Creator[];
it("parseIds keeps 3 unique well-formed ids", () => {
  expect(parseIds("a,b,a,=x,https://e,c,d")).toEqual(["a", "b", "c"]);
  expect(parseIds(undefined)).toEqual([]);
});
it("gaps are explicit and real profiles never show synthetic numbers", () => {
  const real = {
    ...demo[0],
    is_demo: false,
    owner_id: "u",
    price_min_krw: null,
    is_available: null,
  };
  const cells = Object.fromEntries(COMPARE_ROWS.map(([l, f]) => [l, f(real)]));
  for (const k of ["팔로워", "최소 견적", "협업 가능", "오디언스", "기준 시점"])
    expect(cells[k].missing).toBe(true);
  expect(cells["출처·근거"].text).toMatch(/^본인 등록/);
});
it("CSV has ids, value/gap labels and no note column", () => {
  const t = parseCsv(compareCsv(demo.slice(0, 2)));
  expect(t[1]).toEqual(["ID", demo[0].seed_id, demo[1].seed_id]);
  expect(t.map((r) => r[0])).not.toContain("메모");
  expect(t.find((r) => r[0] === "오디언스")![1]).toBe("[결측] 데이터 미확보");
});
