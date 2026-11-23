// D070: HOT must not be an input to organic retrieval/scoring, and is off outside test_demo.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
const forbidden = /entitlement|promotion|creator_hot|hot_/i;
describe("promotion slot separation", () => {
  it("ranking and search code never reads entitlements or promotions", () => {
    for (const f of [
      "src/lib/catalog.ts",
      "src/lib/search.ts",
      "src/lib/data.ts",
      "src/app/api/creators/route.ts",
    ])
      expect(readFileSync(f, "utf8"), f).not.toMatch(forbidden);
    // The latest definition of each search function in SQL.
    const sql = readdirSync("supabase/migrations")
      .sort()
      .map((f) => readFileSync(`supabase/migrations/${f}`, "utf8"))
      .join("\n");
    for (const fn of ["search_creators", "count_creators"]) {
      const defs = sql.split(new RegExp(`function public\\.${fn}\\(`)).slice(1);
      expect(defs.length, fn).toBeGreaterThan(0);
      const body = defs.at(-1)!.split("$$")[1];
      expect(body, fn).not.toMatch(forbidden);
    }
  });
  afterEach(() => vi.unstubAllEnvs());
  it("serves no slots in free_beta", async () => {
    vi.stubEnv("SERVICE_MODE", "free_beta");
    const { promotionSlots } = await import("@/lib/promotions");
    expect(await promotionSlots(true)).toEqual([]);
  });
});
