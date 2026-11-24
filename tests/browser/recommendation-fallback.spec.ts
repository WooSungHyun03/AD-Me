import { expect, test } from "@playwright/test";

test("manual recommendation remains reachable at the current and historical home anchors", async ({
  page,
}, info) => {
  for (const anchor of ["recommendation", "recommend"]) {
    await page.goto(`/#${anchor}`);
    const form = page.getByRole("form", { name: "유튜버 추천 조건" });
    await expect(form).toBeInViewport();
    await form.getByLabel("상품명·설명").fill("가상 테스트 상품");
    await form.getByLabel("타깃 고객").fill("요리를 즐기는 성인 고객");
    await form.getByLabel("콘텐츠 분야").selectOption("음식");
    await form.getByLabel("광고 예산 (원)").fill("10000");
    await form.getByRole("button", { name: "조건에 맞는 유튜버 찾기" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "후보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "가상 테스트 상품 협업 후보",
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(form.getByLabel("상품명·설명")).toHaveValue(
      "가상 테스트 상품",
    );
    await page.locator("#recommendation").screenshot({
      path: `output/playwright/recommendation-anchor-${info.project.name}-${anchor}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
