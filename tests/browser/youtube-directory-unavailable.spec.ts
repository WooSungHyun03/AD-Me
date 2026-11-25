import { test, expect } from "@playwright/test";
test("D033 unconfigured free service keeps directory usable without fictional replacements", async ({
  page,
}) => {
  const response = await page.goto("/creators");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "공개 YouTube 채널" }),
  ).toBeVisible();
  await expect(
    page.getByText("공개 채널을 불러오지 못했습니다.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("youtube-channel")).toHaveCount(0);
  await expect(page.getByTestId("creator-card")).toHaveCount(0);
  expect((await page.request.get("/api/creators/youtube")).status()).toBe(503);
  expect(
    (await page.request.get("/api/creators/youtube?yt-sort=invalid")).status(),
  ).toBe(422);
});
