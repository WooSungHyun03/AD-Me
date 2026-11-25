import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

// D034: DB search pages 24 cards; the total is the filtered result size.
async function expectResults(page: Page, total: number) {
  await expect(page.getByTestId("catalog-count")).toHaveText(
    `${total}명의 크리에이터`,
  );
  await expect(page.getByTestId("creator-card")).toHaveCount(
    Math.min(total, 24),
  );
}

test("catalog restores OR groups, URL, back/forward and reset on desktop and mobile", async ({
  page,
}, info) => {
  await page.goto("/creators?utm_source=review#filters");
  await expectResults(page, 48);
  await page.getByTestId("filter-platform").locator("summary").click();
  const platforms = page.getByRole("group", { name: "플랫폼", exact: true });
  await platforms.getByLabel("YouTube", { exact: true }).check();
  await expectResults(page, 20);
  await platforms.getByLabel("Instagram", { exact: true }).check();
  await expectResults(page, 36);
  await page.getByTestId("filter-category").locator("summary").click();
  const categories = page.getByRole("group", {
    name: "콘텐츠 분야",
    exact: true,
  });
  await categories.getByLabel("뷰티", { exact: true }).check();
  await categories.getByLabel("테크", { exact: true }).check();
  await page.getByTestId("filter-tag").locator("summary").click();
  await page
    .getByRole("group", { name: "이미지·분위기", exact: true })
    .getByLabel("자연스러움", { exact: true })
    .check();
  await expectResults(page, 2);
  const params = new URL(page.url()).searchParams;
  expect(params.getAll("platform")).toEqual(["instagram", "youtube"]);
  expect(params.getAll("category")).toEqual(["뷰티", "테크"]);
  expect(params.get("tag")).toBe("자연스러움");
  expect(params.get("utm_source")).toBe("review");
  await page.getByLabel("정렬", { exact: true }).selectOption("price");
  await page.getByLabel("협업 가능한 크리에이터", { exact: true }).check();
  await expectResults(page, 0);
  await page.goBack();
  await expectResults(page, 2);
  await expect(page.getByLabel("정렬", { exact: true })).toHaveValue("price");
  await page.goForward();
  await expectResults(page, 0);
  await page.goBack();
  await expectResults(page, 2);
  await page.reload();
  await expectResults(page, 2);
  await page.getByTestId("filter-platform").locator("summary").click();
  await expect(platforms.getByLabel("YouTube", { exact: true })).toBeChecked();
  await expect(
    platforms.getByLabel("Instagram", { exact: true }),
  ).toBeChecked();
  if (process.env.ADME_CAPTURE_FILTERS === "1") {
    mkdirSync("harness/evidence/D034", { recursive: true });
    await page.screenshot({
      path: `harness/evidence/D034/catalog-filters-${info.project.name}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await expectResults(page, 48);
  await expect(page.getByLabel("정렬", { exact: true })).toHaveValue("name");
  expect(new URL(page.url()).search).toBe("?utm_source=review");
  expect(new URL(page.url()).hash).toBe("#filters");
  await page.goBack();
  await expectResults(page, 2);
});

test("zero bounds, invalid ranges, empty results and rapid text changes stay explicit", async ({
  page,
}) => {
  await page.goto("/creators?minFollowers=0&maxFollowers=0");
  await expect(page.getByLabel("최소 팔로워", { exact: true })).toHaveValue(
    "0",
  );
  await expect(page.getByLabel("최대 팔로워", { exact: true })).toHaveValue(
    "0",
  );
  await expectResults(page, 0);
  await expect(
    page.getByText("조건에 맞는 크리에이터가 없습니다.", { exact: false }),
  ).toBeVisible();
  await page.goto("/creators?maxPrice=0");
  await expect(page.getByLabel("최대 예산 (원)", { exact: true })).toHaveValue(
    "0",
  );
  await expectResults(page, 0);
  await page.goto("/creators?minPrice=500&maxPrice=0");
  await expect(page.getByTestId("filter-errors")).toContainText(
    "최소 예산은 최대 예산 이하여야 합니다.",
  );
  await expectResults(page, 0);
  await page.getByRole("button", { name: "필터 초기화", exact: true }).click();
  await expectResults(page, 48);
  await page.getByLabel("크리에이터 검색", { exact: true }).fill("서하린");
  await page.getByLabel("크리에이터 검색", { exact: true }).fill("윤소이");
  await expectResults(page, 1);
  await expect(page.getByTestId("creator-card")).toContainText("윤소이");
  await page.reload();
  await expect(page.getByLabel("크리에이터 검색", { exact: true })).toHaveValue(
    "윤소이",
  );
  await expectResults(page, 1);
});

test("filter groups support keyboard selection without overflow at 320/390/768/1440", async ({
  page,
}) => {
  await page.goto("/creators");
  await expectResults(page, 48);
  const group = page.getByTestId("filter-platform");
  await expect(group).toHaveAttribute("aria-busy", "false");
  const summary = group.locator("summary");
  await summary.focus();
  await summary.press("Enter");
  await expect(group).toHaveAttribute("open", "");
  const checkbox = page
    .getByRole("group", { name: "플랫폼", exact: true })
    .getByLabel("YouTube", { exact: true });
  await checkbox.focus();
  await checkbox.press("Space");
  await expect(checkbox).toBeChecked();
  await expectResults(page, 20);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByLabel("최소 팔로워", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "필터 초기화", exact: true }),
    ).toBeVisible();
  }
});
