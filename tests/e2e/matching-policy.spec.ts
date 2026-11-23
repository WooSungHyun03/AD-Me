// D044 UI: brand sets hard/soft matching policy; it persists and drives the shown recommendation policy.
import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
test.skip(
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  ),
  "local Supabase only",
);
const { brand } = JSON.parse(readFileSync(".accounts.local.json", "utf8"));

test("hard category/budget policy is saved and applied", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(brand.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/campaigns/new");
  await page
    .getByLabel("캠페인 이름", { exact: true })
    .fill(`QA 정책 ${randomUUID().slice(0, 6)}`);
  await page.getByLabel("상품·서비스", { exact: true }).fill("정책 검증");
  await page.getByLabel("콘텐츠 분야", { exact: true }).selectOption("뷰티");
  await page.getByLabel("타깃 고객", { exact: true }).fill("20대~30대");
  await page.getByLabel("광고 목적", { exact: true }).fill("정책 검증");
  await page.getByLabel("분야 조건").selectOption("hard");
  await page.getByLabel("예산 조건").selectOption("hard");
  await page
    .getByLabel("필수 조건 정보가 없는 크리에이터")
    .selectOption("exclude");
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page).toHaveURL(/campaigns\/[a-f0-9-]{36}/);
  const id = page.url().split("/").pop()!;
  await expect(
    page.getByText(/추천 정책: 분야 필수 · 예산 필수 · 정보 없음 시 제외/),
  ).toBeVisible();
  // Every shown recommendation must satisfy the hard category gate.
  expect(await page.locator("details").count()).toBeGreaterThan(0);
  for (const d of await page.locator("details").all()) {
    await d.locator("summary").click();
    await expect(d.getByText(/콘텐츠 분야 \(25%\): 100점/)).toBeVisible();
  }
  await page.goto(`/campaigns/${id}/edit`);
  await expect(page.getByLabel("분야 조건")).toHaveValue("hard");
  await expect(page.getByLabel("필수 조건 정보가 없는 크리에이터")).toHaveValue(
    "exclude",
  );
  await page.request.delete(`/api/campaigns?id=${id}`);
});
