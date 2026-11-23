import { expect, it } from "vitest";
import {
  creators,
  match,
  type Brief,
  type MatchingCreator,
} from "@/lib/catalog";
import { localRuntime, sql } from "../support/local-qa.mjs";
const literal = (v: unknown) => JSON.stringify(v).replaceAll("'", "''");
const project = (c: MatchingCreator) => ({
  id: c.seed_id,
  name: "가상 점수 QA",
  published: c.published,
  available: c.is_available,
  platforms: c.platforms,
  vibes: c.vibes,
  categories: c.categories,
  formats: c.formats,
  price: c.price_min_krw,
  isDemo: c.is_demo,
  sourceType: "generated fictional test fixture",
  sourceUrl: null,
});
it("SQL1.2 matches JS1.2 across 48 fictional profiles, hard/soft, held/missing/invalid/zero and gates", () => {
  localRuntime();
  const b: Brief = {
    category: "뷰티",
    vibes: ["자연스러움", "감성적", "자연스러움"],
    format: "숏폼",
    budget_krw: 10000,
    platforms: [],
  };
  const special: MatchingCreator = {
    ...creators[0],
    published: true,
    is_available: true,
    categories: [],
    vibes: [],
    formats: [],
    price_min_krw: null,
  };
  const cases: { b: Brief; c: MatchingCreator }[] = creators.flatMap((c) => [
    { b, c },
    {
      b: {
        ...b,
        policy: { category: "hard", budget: "hard", unknown: "hold" },
      } as Brief,
      c,
    },
    {
      b: {
        ...b,
        policy: { category: "hard", budget: "hard", unknown: "exclude" },
      } as Brief,
      c,
    },
  ]);
  for (const c of [
    special,
    { ...special, price_min_krw: 0 },
    { ...special, price_min_krw: -1 },
    { ...special, price_min_krw: 1.5 },
    { ...special, price_min_krw: 100000001 },
    { ...special, is_available: null },
    { ...special, published: false },
  ]) {
    cases.push(
      { b, c },
      { b: { ...b, policy: { category: "hard", budget: "hard" } }, c },
      { b: { ...b, vibes: [], category: "", format: "", budget_krw: 0 }, c },
    );
  }
  const rows = JSON.parse(
    sql(
      `select jsonb_agg(r order by n) from (${cases
        .map(
          ({ b, c }, n) =>
            `select ${n} n,adme_recommendation.score_v12('${literal(b)}','${literal(project(c))}') r`,
        )
        .join(" union all ")}) t;`,
    ),
  );
  expect(rows).toHaveLength(165);
  for (const [n, actual] of rows.entries()) {
    const expected = match(cases[n].b, cases[n].c);
    for (const key of [
      "eligible",
      "status",
      "reasons",
      "policy",
      "version",
      "score",
      "coverage",
      "matchedTags",
      "missing",
      "breakdown",
    ] as const)
      expect(actual[key], `${n} ${key}`).toEqual(expected[key]);
  }
});
it("rejects malformed policy/budget and preserves the frozen1.0 all-missing score", () => {
  for (const policy of [
    { category: "paid" },
    { unknown: null },
    { injected: true },
    [],
  ])
    expect(() =>
      sql(`select adme_recommendation.normalize_policy('${literal(policy)}');`),
    ).toThrow();
  const c = project({
    ...creators[0],
    is_available: true,
    price_min_krw: null,
  });
  for (const budget_krw of [-1, 0.5, 100000001])
    expect(() =>
      sql(
        `select adme_recommendation.score_v12('${literal({ category: "", vibes: [], format: "", platforms: [], budget_krw })}','${literal(c)}');`,
      ),
    ).toThrow();
  const legacy = JSON.parse(
    sql(
      `select adme_recommendation.score_v1('{"category":"","vibes":[],"format":"","platforms":[],"budget_krw":0}','${literal(c)}');`,
    ),
  );
  expect(legacy.score).toBeNull();
  expect(legacy.coverage).toBe(0);
});
