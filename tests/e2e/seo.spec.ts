// D083: noindex headers on private routes, canonical/OG on public pages, demo env not indexed, and — because
// robots/noindex are not access control — private pages and unpublished profiles are still refused.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
test("indexing boundary and access control", async ({ page, request }) => {
  for (const path of [
    "/dashboard",
    "/admin",
    "/settings",
    "/compare",
    "/api/notifications",
    "/campaigns/new",
    "/login",
  ]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.headers()["x-robots-tag"], path).toBe("noindex, nofollow");
  }
  for (const path of ["/", "/creators", "/about", "/help"]) {
    const r = await request.get(path);
    expect(r.headers()["x-robots-tag"], path).toBeUndefined();
  }
  // Access control is independent of robots: anonymous users are sent to login / refused.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
  expect((await request.get("/api/notifications")).status()).toBe(401);

  // Unpublished profile: the direct URL shows nothing of it.
  const cid = sql(
    `select id from creators where owner_id = '${accounts.creator.id}'`,
  );
  const was = sql(`select published from creators where id = '${cid}'`);
  const name = sql(`select profile->>'name' from creators where id = '${cid}'`);
  sql(`update creators set published = false where id = '${cid}'`);
  try {
    // Root loading.tsx streams first, so the status stays 200; the protection is that nothing renders and it is noindex.
    const html = await (await request.get(`/creators/${cid}`)).text();
    expect(html).not.toContain(name);
    expect(html).toContain("찾을 수 없");
    expect(html).toMatch(/<meta name="robots" content="noindex/);
  } finally {
    sql(`update creators set published = ${was === "t"} where id = '${cid}'`);
  }

  // Public page metadata: canonical + OG; test_demo environment is never indexed.
  await page.goto("/creators");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/creators$/,
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "AD Me",
  );
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  expect(await (await request.get("/robots.txt")).text()).toMatch(
    /Disallow: \/\s*$/m,
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "/creators/",
  );

  // A DEMO profile page is noindex and has no structured data.
  await page.goto("/creators/creator-001");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(
    0,
  );
});
