import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { testProductSchema, testProductTerms, testSkus } from "@/lib/billing";

describe("TEST product display contract", () => {
  it("uses the baseline catalog amount, days and credit fields", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/202611190001_core.sql", import.meta.url),
      "utf8",
    );
    const seed = sql.match(/insert into products values([^;]+);/)?.[1] ?? "";
    const entries = [
      ...seed.matchAll(/\('([^']+)','([^']+)',(\d+),'([^']+)',(\d+),(\d+)\)/g),
    ].map(([, sku, name, amount, role, days, credits]) =>
      testProductSchema.parse({
        sku,
        name,
        amount: Number(amount),
        role,
        days: Number(days),
        credits: Number(credits),
      }),
    );
    expect(entries.map((product) => product.sku)).toEqual([...testSkus]);
    const credits = entries.find((product) => product.sku === "ai_credits");
    expect(credits).toMatchObject({ credits: 20, amount: 4900, days: 30 });
    expect(testProductTerms(credits!)).toBe("20 크레딧 / 4,900원 · 30일");
  });
});
