import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("shipped software notices match exact manifest and remain accessible on desktop/mobile", async ({
  page,
}, info) => {
  const manifest = JSON.parse(
    readFileSync("docs/licenses/20261121-shipping/manifest.json", "utf8"),
  );
  await page.goto("/licenses");
  await expect(
    page.getByRole("heading", { name: "오픈소스 고지", exact: true }),
  ).toBeVisible();
  const r = await page.request.get("/legal/third-party-notices.txt");
  expect(r.status()).toBe(200);
  const body = await r.body();
  expect(createHash("sha256").update(body).digest("hex")).toBe(manifest.sha256);
  expect(body.length).toBe(manifest.bytes);
  const extra = JSON.parse(
    readFileSync("docs/licenses/20261122-supplement/manifest.json", "utf8"),
  );
  await expect(
    page.getByRole("link", {
      name: "배포물의 보완 고지·구성요소 자료 보기",
      exact: true,
    }),
  ).toBeVisible();
  const supplement = await page.request.get(
    "/legal/third-party-supplement-20261122.txt",
  );
  expect(supplement.status()).toBe(200);
  const material = await supplement.body();
  expect(createHash("sha256").update(material).digest("hex")).toBe(
    extra.sha256,
  );
  expect(material.length).toBe(extra.bytes);
  expect(material.toString()).toContain("README_LICENSING_DISCLOSURE");
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const issues = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (options: unknown) => Promise<{ violations: { id: string }[] }>;
        };
      }
    ).axe.run({
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
      },
    });
    return result.violations.map((v) => v.id);
  });
  expect(issues).toEqual([]);
  await page.screenshot({
    path: `output/playwright/licenses-supplement-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
