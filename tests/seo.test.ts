// D083: indexing boundary — only published, owner-verified, non-demo profiles are indexable; every top-level
// route is classified as public or private; demo environment is never indexed.
import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { PRIVATE_PREFIXES, PUBLIC_PAGES, indexable } from "@/lib/seo";
vi.mock("@/lib/data", () => ({
  publicCreators: async () => [
    {
      seed_id: "demo-1",
      is_demo: true,
      claim_status: "verified",
      published: true,
    },
    {
      seed_id: "user-ok",
      is_demo: false,
      claim_status: "verified",
      published: true,
    },
    {
      seed_id: "collected-1",
      is_demo: false,
      claim_status: "unclaimed",
      published: true,
    },
    {
      seed_id: "user-hidden",
      is_demo: false,
      claim_status: "verified",
      published: false,
    },
  ],
}));
afterEach(() => vi.unstubAllEnvs());
describe("seo boundary", () => {
  it("indexable = published + verified + not demo", () => {
    expect(
      indexable({ is_demo: false, claim_status: "verified", published: true }),
    ).toBe(true);
    expect(
      indexable({ is_demo: true, claim_status: "verified", published: true }),
    ).toBe(false);
    expect(
      indexable({ is_demo: false, claim_status: "unclaimed", published: true }),
    ).toBe(false);
    expect(
      indexable({ is_demo: false, claim_status: "verified", published: false }),
    ).toBe(false);
  });
  it("every top-level route is classified public or private", () => {
    const dirs = readdirSync("src/app").filter((d) =>
      statSync(`src/app/${d}`).isDirectory(),
    );
    const known = new Set(
      [...PRIVATE_PREFIXES, ...PUBLIC_PAGES].map((p) => p.slice(1)),
    );
    for (const d of dirs)
      expect(known.has(d), `/${d} not classified`).toBe(true);
  });
  it("free_beta: sitemap lists only indexable profiles; robots blocks private paths", async () => {
    vi.stubEnv("SERVICE_MODE", "free_beta");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://adme.example.test/");
    const urls = (await (await import("@/app/sitemap")).default()).map(
      (x) => x.url,
    );
    expect(urls).toContain("https://adme.example.test/creators/user-ok");
    expect(urls.filter((u) => u.includes("/creators/"))).toEqual([
      "https://adme.example.test/creators/user-ok",
    ]);
    const r = (await import("@/app/robots")).default();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.disallow).toEqual(
      expect.arrayContaining(["/dashboard", "/admin/", "/api/"]),
    );
    expect(r.sitemap).toBe("https://adme.example.test/sitemap.xml");
  });
  it("test_demo: nothing indexed", async () => {
    vi.stubEnv("SERVICE_MODE", "test_demo");
    expect(await (await import("@/app/sitemap")).default()).toEqual([]);
    const rules = (await import("@/app/robots")).default().rules;
    expect(Array.isArray(rules) ? rules[0].disallow : rules.disallow).toBe("/");
  });
});
