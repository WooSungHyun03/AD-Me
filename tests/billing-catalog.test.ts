import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  freeFeatures,
  testProductSchema,
  testProductTerms,
  testSkus,
} from "@/lib/billing";

describe("TEST product display contract", () => {
  it("uses the baseline catalog amount, days and credit fields", () => {
    const sql = readFileSync(
      new URL("../supabase/migrations/202611190001_core.sql", import.meta.url),
      "utf8",
    );
    const marketplace = readFileSync(
      new URL(
        "../supabase/migrations/20261122115249_youtube_marketplace.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const seed =
      (sql.match(/insert into products values([^;]+);/)?.[1] ?? "") +
      (marketplace.match(
        /insert into public.products[^;]+values([^;]+);/,
      )?.[1] ?? "");
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
    // D002: PRD quantity/price statements must match the seeded catalog.
    const prd = readFileSync(
      new URL("../docs/PRD.md", import.meta.url),
      "utf8",
    );
    for (const product of entries.filter((entry) => entry.credits > 0))
      expect(prd).toContain(`${product.amount.toLocaleString("ko-KR")}원`);
    expect(prd).toContain("분석 크레딧 20개");
  });
  it("renders the free beta list from the single freeFeatures source", () => {
    const pricing = readFileSync(
      new URL("../src/components/pricing-plans.tsx", import.meta.url),
      "utf8",
    );
    expect(pricing).toContain("freeFeatures.map");
    const page = readFileSync(
      new URL("../src/app/pricing/page.tsx", import.meta.url),
      "utf8",
    );
    expect(page).toContain('export const dynamic = "force-dynamic"');
    expect(freeFeatures.join(" ")).toContain("YouTube");
  });
});
