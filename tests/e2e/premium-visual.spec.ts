import { expect, test, type Locator } from "@playwright/test";

async function expectReadableAction(action: Locator) {
  await action.scrollIntoViewIfNeeded();
  await expect(action).toBeVisible();
  await expect(action).toBeEnabled();
  const dimensions = await action.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const label = document.createRange();
    label.selectNodeContents(node);
    const ink = label.getBoundingClientRect();
    const style = getComputedStyle(node);
    const rgb = (value: string) =>
      (value.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const luminance = (value: string) =>
      rgb(value)
        .map((n) => {
          const s = n / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, channel, index) =>
            sum + channel * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    const l1 = luminance(style.color);
    const l2 = luminance(style.backgroundColor);
    const hit = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return {
      contained: rect.left >= -1 && rect.right <= innerWidth + 1,
      readable: ink.left >= rect.left - 1 && ink.right <= rect.right + 1,
      hit: Boolean(hit && node.contains(hit)),
      height: rect.height,
      contrast: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
    };
  });
  expect(dimensions).toMatchObject({
    contained: true,
    readable: true,
    hit: true,
  });
  expect(dimensions.height).toBeGreaterThanOrEqual(44);
  expect(dimensions.contrast).toBeGreaterThanOrEqual(4.5);
  await action.click({ trial: true });
}

test("job posting pass and all primary pricing actions have visible, readable targets", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expectReadableAction(
    page.getByRole("link", { name: "무료로 시작하기" }).first(),
  );
  for (const sku of [
    "search_run",
    "job_post",
    "job_application",
    "creator_hot",
  ]) {
    const product = page.getByTestId("pricing-" + sku);
    const action = product.getByRole("link").or(product.getByRole("button"));
    await expectReadableAction(action);
  }
  const posting = page.getByTestId("pricing-job_post");
  await expect(
    posting.getByRole("heading", { name: "광고 공고 게시권" }),
  ).toBeVisible();
  const draft = posting.getByRole("link", { name: "공고 초안 작성" });
  if (process.env.ADME_LOCAL_QA === "1") await expect(draft).toHaveCount(0);
  if (await draft.count()) {
    await draft.click();
    await expect(page).toHaveURL(/\/jobs\/new|\/login/);
  } else {
    await posting.getByRole("button", { name: "TEST 이용권 선택" }).click();
    await expect(posting.getByRole("alert")).toContainText("로그인");
  }
});

test("home navigation links reach the discovery and recommendation sections", async ({
  page,
}) => {
  await page.goto("/");
  const hero = page.locator(".premium-hero");
  const recommend = hero.getByRole("link", { name: "추천 조건 입력" });
  await expectReadableAction(recommend);
  await recommend.click();
  await expect(page).toHaveURL(/#recommendation$/);
  const form = page.getByRole("form", { name: "유튜버 추천 조건" });
  await expect(form.getByLabel("상품명·설명")).toBeVisible();
  await hero.getByRole("link", { name: "채널 탐색" }).click();
  await expect(page).toHaveURL(/\/creators$/);
  await expect(page.getByLabel("YouTube 주제")).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "메인 메뉴" }),
  ).not.toContainText("AI 스튜디오");
});

test("official topic and sort persist in the public directory results", async ({
  page,
}) => {
  await page.goto("/creators");
  const select = page.getByLabel("YouTube 주제");
  const cards = page.getByTestId("youtube-channel");
  await expect(cards.filter({ hasText: "쯔양" })).toBeVisible();
  await select.selectOption("음식");
  await page.getByLabel("결과 정렬").selectOption("subscribers");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await expect(page).toHaveURL(/yt-sort=subscribers/);
  await expect(cards.first()).toContainText("쯔양");
  await expect(cards.filter({ hasText: "PONY" })).toHaveCount(0);
  await select.selectOption("테크·게임");
  await page.getByRole("button", { name: "필터 적용" }).click();
  await expect(select).toHaveValue("테크·게임");
  await expect(cards.filter({ hasText: "쯔양" })).toHaveCount(0);
});
