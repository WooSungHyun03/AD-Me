// D043 UI: brand sets deadline/capacity, values persist, past deadline is refused by the server. Local Supabase only.
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
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const local = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

test("brand sets recruiting deadline and capacity; past deadline is refused", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts.brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  const title = `QA 모집 ${randomUUID().slice(0, 6)}`;
  await page.goto("/campaigns/new");
  await page.getByLabel("캠페인 이름", { exact: true }).fill(title);
  await page.getByLabel("상품·서비스", { exact: true }).fill("모집 검증");
  await page.getByLabel("타깃 고객", { exact: true }).fill("20대~30대");
  await page.getByLabel("광고 목적", { exact: true }).fill("모집 규칙 검증");
  await page.getByLabel("공개 상태").selectOption("published");
  await page
    .getByLabel("모집 마감 일시 (선택)")
    .fill(local(new Date(Date.now() + 3 * 864e5)));
  await page.getByLabel("선정 인원 (선택, 1~100)").fill("2");
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page).toHaveURL(/campaigns\/[a-f0-9-]{36}/);
  const id = page.url().split("/").pop()!;
  await expect(page.getByText("0/2명")).toBeVisible();

  await page.goto("/campaigns");
  await expect(
    page.getByRole("link", { name: new RegExp(title) }),
  ).toContainText("선정 2명");

  await page.goto(`/campaigns/${id}/edit`);
  await expect(page.getByLabel("선정 인원 (선택, 1~100)")).toHaveValue("2");
  await page
    .getByLabel("모집 마감 일시 (선택)")
    .fill(local(new Date(Date.now() - 864e5)));
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("현재 시각 이후");

  await page.getByLabel("모집 마감 일시 (선택)").fill("");
  await page.getByLabel("공개 상태").selectOption("closed");
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page).toHaveURL(new RegExp(`campaigns/${id}$`));
  await expect(page.getByText("모집이 마감되었습니다").first()).toBeVisible();
});
