// D015: marketing is never pre-checked; settings save service/marketing/interests separately and persist.
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
test("consent: no pre-checked marketing; preferences persist and can be withdrawn", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(page.locator("input[type=checkbox]:checked")).toHaveCount(0);

  await login(page, accounts.creator);
  await page.goto("/settings");
  const form = page.getByRole("form", { name: "알림·관심 분야" });
  const marketing = form.getByLabel(/마케팅 메일/);
  const service = form.getByLabel(/서비스 알림 메일/);
  await expect(marketing).not.toBeChecked();
  await expect(service).toBeChecked();
  const save = async () => {
    await form.getByRole("button", { name: "알림 설정 저장" }).click();
    await expect(form.getByText("알림 설정을 저장했습니다.")).toBeVisible();
    await page.reload();
  };
  await marketing.check();
  await form.locator("input[name=interest]").first().check();
  await save();
  await expect(marketing).toBeChecked();
  await expect(form.getByText(/마케팅 수신 동의일/)).toBeVisible();
  await expect(form.locator("input[name=interest]:checked")).toHaveCount(1);
  // Withdraw and restore defaults.
  await marketing.uncheck();
  await form.locator("input[name=interest]").first().uncheck();
  await save();
  await expect(marketing).not.toBeChecked();
  await expect(service).toBeChecked();
});
