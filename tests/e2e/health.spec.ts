// D086: public health reveals only {status}; connection details and usage are admin-only.
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
test("health: anonymous and non-admin get status only; admin gets details", async ({
  page,
  request,
}) => {
  const anon = await request.get("/api/health");
  expect(anon.status()).toBe(200);
  expect(await anon.json()).toEqual({ status: "ok" });
  expect(anon.headers()["cache-control"]).toContain("no-store");

  await login(page, accounts.brand);
  expect(await (await page.request.get("/api/health")).json()).toEqual({
    status: "ok",
  });

  await login(page, accounts.admin);
  const d = await (await page.request.get("/api/health")).json();
  expect(d.status).toBe("ok");
  expect(d.stats.migration).toMatch(/^\d{12}$/);
  expect(Object.values(d.configured).every((v) => typeof v === "boolean")).toBe(
    true,
  );
  expect(JSON.stringify(d)).not.toMatch(/eyJ|sb_secret|@example\.com/);
  await page.goto("/admin");
  await expect(page.getByTestId("health-status")).toContainText("DB 정상");
  await expect(page.getByTestId("usage")).toHaveCount(3);
});
