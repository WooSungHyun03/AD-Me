import { test, expect } from "@playwright/test";
test("YouTube natural filter proposal requires confirmation and refuses unsupported/negated alternatives", async ({
  page,
}, info) => {
  await page.goto("/creators");
  await page.getByText("문장으로 검색 조건 제안받기", { exact: true }).click();
  const initial = page.url(),
    input = page.getByLabel("검색 문장", { exact: true });
  for (const [text, message] of [
    ["유튜브 뷰티 제외", "제외·부정·선택 조건"],
    ["인스타그램 뷰티 예산 100만원 이하", "YouTube만 지원"],
    ["뷰티 또는 테크", "제외·부정·선택 조건"],
  ]) {
    await input.fill(text);
    await page
      .getByRole("button", { name: "조건 제안 확인", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "검색 조건 제안" }),
    ).toContainText(message);
    await expect(
      page.getByRole("button", { name: "확인한 조건 적용", exact: true }),
    ).toBeDisabled();
    expect(page.url()).toBe(initial);
  }
  await input.fill("유튜브 뷰티 예산 100만원 이하");
  await page
    .getByRole("button", { name: "조건 제안 확인", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "검색 조건 제안" }),
  ).toContainText("예산 100만원 이하");
  expect(page.url()).toBe(initial);
  await page.getByRole("button", { name: "제안 취소", exact: true }).click();
  expect(page.url()).toBe(initial);
  await page
    .getByRole("button", { name: "조건 제안 확인", exact: true })
    .click();
  await page
    .getByRole("button", { name: "확인한 조건 적용", exact: true })
    .click();
  await expect(page).not.toHaveURL(initial);
  const query = new URL(page.url()).searchParams;
  expect(query.getAll("platform")).toEqual(["youtube"]);
  expect(query.get("maxPrice")).toBe("1000000");
  await expect(page.getByTestId("catalog-count")).toContainText(
    /\d+명의 크리에이터/,
  );
  await expect(
    page.getByText("검색 결과를 불러오고 있습니다.", { exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: `output/playwright/search-proposal-scope-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
