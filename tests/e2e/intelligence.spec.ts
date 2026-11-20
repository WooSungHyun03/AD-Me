import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const accounts = JSON.parse(
  readFileSync(".accounts.local.json", "utf8"),
) as Record<string, { email: string; password: string }>;

async function login(page: Page, account: "admin" | "brand") {
  await page.goto("/login");
  await page
    .getByLabel("이메일", { exact: true })
    .fill(accounts[account].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[account].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("operations console checks sessions and permissions on desktop and mobile", async ({
  page,
}, info) => {
  await page.goto("/admin/intelligence");
  await expect(page).toHaveURL(/login/);
  await login(page, "brand");
  await page.goto("/admin/intelligence");
  await expect(
    page.getByRole("heading", { name: "관리자 권한이 필요합니다." }),
  ).toBeVisible();
  const denied = await page.request.post("/api/admin/intelligence", {
    data: { action: "channel", value: "UC_x5XG1OV2P6uZZ5FSM9Ttw" },
  });
  expect(denied.status()).toBe(403);
  const isolated = await page.context().browser()!.newContext(info.project.use);
  try {
    const admin = await isolated.newPage();
    await login(admin, "admin");
    await admin.goto("/admin/intelligence");
    await expect(
      admin.getByRole("heading", { name: "운영 콘솔", exact: true }),
    ).toBeVisible();
    await expect(
      admin.getByRole("heading", { name: "YouTube 수집", exact: true }),
    ).toBeVisible();
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await admin.screenshot({
      path: `output/playwright/operations-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await isolated.close();
  }
});

test("brand submits a private Korean draft to the real worker", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "한 작업으로 동일한 DB와 로컬 모델 경로를 검증합니다.",
  );
  await login(page, "brand");
  await page.goto("/tools/local");
  await page
    .getByLabel("광고 브리프")
    .fill(
      "무향 선크림을 소개하는 인스타그램 릴스. 효능을 단정하지 말고 손에 바르는 장면을 포함해주세요.",
    );
  await page.getByRole("button", { name: "초안 생성" }).click();
  await expect(
    page.getByRole("heading", { name: "협업 제안 초안" }),
  ).toBeVisible({ timeout: 75000 });
  await expect(page.locator("article").first()).toContainText(/[가-힣]/);
});
