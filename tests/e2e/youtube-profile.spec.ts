import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import {
  channels,
  isolatedYoutube,
  routeYoutubeImages,
} from "./support/youtube";

for (const channel of channels) {
  test(`official YouTube data and media render for ${channel.id}`, async ({
    page,
  }) => {
    await routeYoutubeImages(page);
    await page.goto("/creators");
    const directory = page
      .getByTestId("youtube-channel")
      .filter({ hasText: channel.name });
    await expect(directory).toBeVisible();
    const directoryImage = await directory
      .locator(".youtube-image--avatar img")
      .getAttribute("src");
    await directory.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      channel.name,
    );
    if (
      await page.getByText("AD Me 소유권 미확인", { exact: true }).isVisible()
    ) {
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
    }
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`/creators/youtube/${channel.id}$`),
    );
    const avatar = page.locator(".youtube-image--avatar img");
    await expect(avatar).toHaveAttribute("src", directoryImage!);
    await expect
      .poll(() =>
        avatar.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const banner = page.locator(".youtube-image--banner img");
    await expect
      .poll(() =>
        banner.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await expect(
      page.getByRole("link", { name: "YouTube 원본 채널 열기" }),
    ).toHaveAttribute("href", "https://www.youtube.com/channel/" + channel.id);
    await expect(page.locator("#overview dl").first()).toContainText(
      "채널 누적 조회수",
    );
    await expect(page.locator("#overview dl").first()).toContainText(/\d.+회/);
    await expect(page.locator("#overview")).toContainText("통계 출처");
    const videos = page.locator("#videos > ul");
    await expect(videos.locator("li")).toHaveCount(isolatedYoutube ? 5 : 12);
    const firstVideo = videos.getByRole("link").first();
    await firstVideo.scrollIntoViewIfNeeded();
    await expect(firstVideo).toHaveAttribute(
      "href",
      /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/,
    );
    const thumbnail = firstVideo.locator("img");
    await expect
      .poll(() =>
        thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    const more = page.locator("#videos details");
    if (isolatedYoutube) {
      await expect(more).toHaveCount(0);
    } else {
      await more.locator("summary").click();
      await expect(more.getByRole("link")).toHaveCount(18);
    }
    await expect(page.locator("#collaboration")).toContainText(
      "공개된 업무 연락처가 없습니다.",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  });
}

test("a signed-in user can save and remove a YouTube channel", async ({
  page,
}) => {
  const { brand } = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(brand.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const detail = "/creators/youtube/" + channels[0].id;
  await page.goto(detail);
  const saved = page.getByRole("button", { name: "저장됨", exact: true });
  const save = page.getByRole("button", {
    name: "관심 채널 저장",
    exact: true,
  });
  if (await saved.isVisible()) await saved.click();
  await save.click();
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(saved).toBeVisible();
  await page.goto("/dashboard");
  const favorite = page.getByRole("link", {
    name: new RegExp(channels[0].name),
  });
  await expect(favorite).toHaveAttribute("href", detail);
  await favorite.click();
  await saved.click();
  await expect(save).toBeVisible();
  await page.goto("/dashboard");
  await expect(favorite).toHaveCount(0);
});

test("the homepage brief filters the public directory by official topic", async ({
  page,
}) => {
  test.skip(isolatedYoutube, "Requires the published directory topic metadata");
  await page.goto("/");
  await page.getByLabel("상품명·설명").fill("테스트 상품");
  await page.getByLabel("타깃 고객").fill("운동을 즐기는 성인");
  await page.getByLabel("광고 예산 (원)").fill("1000000");
  const topic = page.getByLabel("콘텐츠 분야");
  const submit = page.getByRole("button", {
    name: "조건에 맞는 유튜버 찾기",
  });
  const result = page.locator(".brief-results");
  const foodChannel = result.getByRole("link", { name: /쯔양/ });
  await topic.selectOption("음식");
  await submit.click();
  await expect(foodChannel).toBeVisible();
  await topic.selectOption("테크·게임");
  await submit.click();
  await expect(result).toContainText("테크·게임 · 최대");
  await expect(foodChannel).toHaveCount(0);
});
