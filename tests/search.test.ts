import { describe, it, expect, afterEach, vi } from "vitest";
import { searchCreators, searchSchema } from "../src/lib/search";
import { GET } from "../src/app/api/creators/route";

const parse = (o: Record<string, string>) => searchSchema.safeParse(o);
describe("D033 search input contract", () => {
  it("caps page size and rejects unknown sort/taxonomy/cursor", () => {
    expect(parse({ limit: "49" }).success).toBe(false);
    expect(parse({ limit: "0" }).success).toBe(false);
    expect(parse({ sort: "owner_id" }).success).toBe(false);
    expect(parse({ category: "<x>" }).success).toBe(false);
    expect(parse({ platform: "facebook" }).success).toBe(false);
    expect(parse({ cursor: "not-base64-json" }).success).toBe(false);
    expect(parse({ min_followers: "-1" }).success).toBe(false);
    expect(parse({ q: "x".repeat(81) }).success).toBe(false);
  });
  it("ignores client attempts to include demo or private fields", () => {
    const r = parse({ include_demo: "true", owner_id: "x" });
    expect(r.success && Object.keys(r.data)).not.toContain("include_demo");
  });
  it("defaults: name sort, 24 per page, empty strings are 'no filter'", () => {
    const r = parse({ q: "", budget: "" });
    expect(
      r.success && [r.data.sort, r.data.limit, r.data.q, r.data.budget],
    ).toEqual(["name", 24, undefined, undefined]);
  });
});

describe("D033 keyless demo pagination", () => {
  afterEach(() => vi.unstubAllEnvs());
  const demo = () => {
    vi.stubEnv("SERVICE_MODE", "test_demo");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  };
  for (const sort of ["name", "followers", "price"] as const) {
    it(`walks every page once without duplicates (${sort})`, async () => {
      demo();
      const seen: string[] = [];
      let cursor: string | null = null;
      let total: number | null = null;
      do {
        const input = searchSchema.parse({
          sort,
          limit: "10",
          ...(cursor ? { cursor } : {}),
        });
        const page = await searchCreators(input);
        total ??= page.total;
        expect(page.items.length).toBeLessThanOrEqual(10);
        page.items.forEach((c) => expect(c.owner_id).toBeNull());
        seen.push(...page.items.map((c) => c.seed_id));
        cursor = page.nextCursor;
      } while (cursor);
      expect(new Set(seen).size).toBe(seen.length);
      expect(seen.length).toBe(48);
      expect(total).toBe(48);
    });
  }
  it("API rejects invalid input with 400 and serves free_beta-safe errors", async () => {
    demo();
    expect(
      (await GET(new Request("http://localhost/api/creators?limit=500")))
        .status,
    ).toBe(400);
    const ok = await GET(
      new Request("http://localhost/api/creators?platform=youtube&limit=5"),
    );
    const d = await ok.json();
    expect(d.items.length).toBe(5);
    expect(
      d.items.every((c: { platforms: string[] }) =>
        c.platforms.includes("youtube"),
      ),
    ).toBe(true);
    vi.stubEnv("SERVICE_MODE", "free_beta");
    expect(
      (await GET(new Request("http://localhost/api/creators"))).status,
    ).toBe(503);
  });
});
