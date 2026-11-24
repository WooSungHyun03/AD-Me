import { expect, test } from "@playwright/test";

test("service guidance describes the active YouTube scope", async ({ page }) => {
  await page.goto("/about");
  const main = page.getByRole("main");
  await expect(main).toContainText("YouTube 채널을 대상으로 탐색·추천·캠페인을 제공합니다.");
  await expect(main).toContainText("다른 SNS의 신규 계정 연동은 지원하지 않습니다.");
  await expect(main).not.toContainText("Instagram");
  await expect(main).not.toContainText("TikTok");
});
