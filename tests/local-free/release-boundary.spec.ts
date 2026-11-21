import { expect, test } from "@playwright/test";
import { localRuntime, localClient } from "../support/local-qa.mjs";

test("free actual-DB source excludes DEMO counts and denies billing in app and direct REST", async ({
  page,
}) => {
  localRuntime();
  const db = localClient(),
    summary = await db.rpc("creator_home_summary", { p_demo: false });
  expect(summary.error).toBeNull();
  expect(summary.data.demo).toBe(0);
  await page.goto("/");
  await expect(
    page.getByText(`현재 공개 프로필 ${summary.data.total}명`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.getByText("집계 시각", { exact: false })).toBeVisible();
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "무료 베타", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "TEST 상품", exact: true }),
  ).toHaveCount(0);
  for (const endpoint of ["orders", "confirm"])
    expect(
      (
        await page.request.post(`/api/billing/${endpoint}`, { data: {} })
      ).status(),
    ).toBe(404);
  expect((await db.from("products").select("sku")).data).toEqual([]);
  expect((await db.rpc("test_billing_available")).data).toBe(false);
  expect((await db.rpc("active_hot_creators")).data).toEqual([]);
});
