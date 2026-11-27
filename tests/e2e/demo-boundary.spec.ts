import { expect, test } from "@playwright/test";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("D005 explicit isolated TEST DB retains labeled legacy creators and campaigns", async ({
  page,
}, info) => {
  localRuntime();
  expect(sql("select demo_enabled from adme_release.catalog_boundary")).toBe(
    "t",
  );
  await page.goto("/creators/creator-001");
  await expect(
    page.getByRole("heading", { name: "서하린", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("가상 프로필 · DEMO", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/d005-test-profile-${info.project.name}.png`,
    fullPage: true,
  });
  const response = await page.request.get("/api/creators");
  expect(response.status()).toBe(200);
  expect(
    (await response.json()).items.some((c: { is_demo: boolean }) => c.is_demo),
  ).toBe(true);
  await page.goto("/campaigns/campaign-001");
  await expect(
    page.getByText("가상 캠페인 · DEMO", { exact: true }),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/compare?ids=creator-001,creator-002")
    ).status(),
  ).toBe(200);
  expect((await page.request.get("/sitemap.xml")).status()).toBe(200);
});
