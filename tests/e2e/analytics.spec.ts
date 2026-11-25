// D006: settings opt-out round-trips; tests/analytics.mjs checks access to funnel data.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("analytics: opt-out toggle persists after reload", async ({ page }) => {
  await login(page, accounts.creator);
  await page.goto("/settings");
  const box = page.getByLabel(/이용 통계/);
  await expect(box).not.toBeChecked();
  for (const on of [true, false]) {
    await box.setChecked(on);
    await page.getByRole("button", { name: "계정 정보 저장" }).click();
    await expect(page.getByText("계정 이름을 저장했습니다.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel(/이용 통계/)).toBeChecked({ checked: on });
  }
});
