import { expect, it } from "vitest";
import { creators, match, type Brief } from "@/lib/catalog";
import { localRuntime, sql } from "../support/local-qa.mjs";
it("frozen SQL v1 scorer reproduces catalog factors for all48 fixtures, missing/zero and price boundaries without HOT inputs", () => {
  localRuntime();
  const cases = creators.flatMap((c) => [
    {
      c,
      b: {
        category: c.categories[0],
        vibes: c.vibes,
        format: c.formats[0],
        budget_krw: c.price_max_krw,
        platforms: c.platforms,
      },
    },
    {
      c,
      b: { category: "", vibes: [], format: "", budget_krw: 0, platforms: [] },
    },
    {
      c,
      b: {
        category: "unknown",
        vibes: ["unknown", ...c.vibes].slice(0, 8),
        format: "unknown",
        budget_krw: 10000,
        platforms: ["no-match"],
      },
    },
  ]);
  const literal = (v: unknown) => JSON.stringify(v).replaceAll("'", "''");
  const inputs = cases
    .map(
      ({ c, b }, n) =>
        `select ${n} n,adme_recommendation.score_v1('${literal(b)}'::jsonb,adme_recommendation.project(adme_creator.catalog_dto(cr))) r from public.creators cr where cr.id='${c.seed_id}'`,
    )
    .join(" union all ");
  const rows = JSON.parse(
    sql(
      `select jsonb_agg(jsonb_build_object('n',n,'r',r) order by n) from (${inputs}) t;`,
    ),
  );
  expect(rows).toHaveLength(144);
  expect(new Set(rows.map((r: { n: number }) => r.n)).size).toBe(144);
  for (const row of rows) {
    const { c, b } = cases[row.n];
    const actual = row.r,
      // Frozen1.0 calculated factors even for platform/unavailable exclusions.
      // Compare those known-data factors independently from the current1.2 gate.
      base = match({ ...b, platforms: [] } as Brief, {
        ...c,
        published: true,
        is_available: true,
      });
    expect(actual.score).toBe(base.coverage ? base.score : null);
    expect(actual.coverage).toBe(base.coverage);
    expect(actual.matchedTags).toEqual(base.matchedTags);
    expect(actual.missing).toEqual(base.missing);
    expect(actual.eligible).toBe(match(b as Brief, c).eligible);
    expect(
      actual.breakdown.map((x: { value: number | null }) => x.value),
    ).toEqual(base.breakdown.map((x) => x.value));
  }
  const special = { ...creators[0], price_min_krw: 0, is_available: true };
  const b = {
    category: special.categories[0],
    vibes: special.vibes,
    format: special.formats[0],
    budget_krw: 10000,
    platforms: [],
  };
  const dto = { ...special, source_url: null };
  const actual = JSON.parse(
    sql(
      `select adme_recommendation.score_v1('${literal(b)}','${literal({ id: dto.seed_id, name: dto.name, published: dto.published, available: true, platforms: dto.platforms, vibes: dto.vibes, categories: dto.categories, formats: dto.formats, price: 0, isDemo: dto.is_demo, sourceType: dto.data_source, sourceUrl: null })}');`,
    ),
  );
  expect(actual.score).toBe(match(b, special).score);
});
