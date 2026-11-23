import { expect, test } from "@playwright/test";

test("free mode serves the free plan and denies direct TEST billing", async ({
  page,
}, info) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "무료 베타" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "TEST 상품" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "이용권 구매하기" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("pricing.png"),
    fullPage: true,
  });

  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "TEST 상품 안내" }),
  ).toHaveCount(0);
  for (const endpoint of ["orders", "confirm"]) {
    const response = await page.request.post(`/api/billing/${endpoint}`, {
      data: {},
    });
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toMatchObject({
      code: "NOT_FOUND",
      requestId: response.headers()["x-request-id"],
    });
  }
});

test("mail disabled pages and SPA controls remain usable without keys", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(page.getByRole("status")).toContainText(
    "가입 메일 서비스 연결을 준비 중",
  );
  await page.goto("/signup/resend");
  await expect(
    page.getByRole("heading", { name: "가입 확인 메일 다시 받기" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "확인 메일 재발송" }),
  ).toHaveCount(0);
  await page.goto("/signup");
  await page.getByRole("link", { name: "로그인", exact: true }).last().click();
  await page.getByRole("link", { name: "비밀번호를 잊으셨나요?" }).click();
  await expect(page.getByRole("status")).toContainText(
    "복구 메일 서비스 연결을 준비 중",
  );
  const callback = await page.request.get(
    "/auth/callback?next=https://example.invalid&code=fixture",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(new URL(callback.headers().location, page.url()).pathname).toBe(
    "/auth/error",
  );
  expect(callback.headers()["referrer-policy"]).toBe("no-referrer");
  expect(callback.headers()["set-cookie"]).toBeUndefined();

  await page.goto("/tools");
  await expect(page).toHaveURL(/\/creators$/);
  await expect(
    page.getByRole("navigation", { name: "메인 메뉴" }),
  ).not.toContainText("AI 스튜디오");
});
