import { expect, test } from "@playwright/test";

test("light public surfaces and candidate entry points fit each viewport", async ({
  page,
}) => {
  for (const width of [360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [url, hero] of [
      ["/", ".premium-hero"],
      ["/pricing", ".pricing-hero"],
      ["/creators", ".discovery-hero"],
    ]) {
      await page.goto(url);
      const surface = page.locator(hero);
      await expect(surface).toBeVisible();
      const redChannel = await surface.evaluate((node) =>
        Number(getComputedStyle(node).backgroundColor.match(/\d+/)?.[0]),
      );
      expect(redChannel).toBeGreaterThan(210);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
    }
  }
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "추천 조건 입력" }),
  ).toHaveAttribute("href", "#recommendation");
  await expect(page.getByRole("link", { name: "상품 등록" })).toHaveAttribute(
    "href",
    "/brand/products",
  );
  await expect(
    page.getByRole("link", { name: "공고 찾아보기" }),
  ).toHaveAttribute("href", "/jobs");
});

test("ambient motion can be paused and respects reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const decoration = page.locator(".hero-ambient-shape");
  await expect(decoration).toHaveCSS("animation-play-state", "running");
  await page.getByRole("button", { name: "배경 모션 일시정지" }).click();
  await expect(decoration).toHaveCSS("animation-play-state", "paused");
  await page.getByRole("button", { name: "배경 모션 재생" }).click();
  await expect(decoration).toHaveCSS("animation-play-state", "running");
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await expect(decoration).toHaveCSS("animation-play-state", "paused");

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(decoration).toHaveCSS("animation-name", "none");
  await expect(page.getByRole("button", { name: /배경 모션/ })).toHaveCount(0);
});
