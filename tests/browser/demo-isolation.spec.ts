import { expect, test } from "@playwright/test";
test("D005 keyless free mode reports missing data and never substitutes bundled profiles or campaigns", async ({
  page,
}, info) => {
  await page.goto("/creators");
  await expect(
    page.getByText("등록 프로필 연결을 준비 중입니다.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("가상 프로필 · DEMO", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `output/playwright/d005-keyless-${info.project.name}.png`,
    fullPage: true,
  });
  expect((await page.request.get("/api/creators")).status()).toBe(503);
  await page.goto("/campaigns");
  await expect(
    page.getByText("현재 공개 모집 중인 캠페인이 없습니다.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("가상 캠페인 · DEMO", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/campaigns/campaign-001");
  await expect(
    page.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
  ).toBeVisible();
});
