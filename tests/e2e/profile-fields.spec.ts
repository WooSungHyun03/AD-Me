// D026: multi-select taxonomy, unknown quote/availability persist as "미확인" (not 0원/가능). Local Supabase only.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
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

test("creator saves multi-tag profile with unknown quote and availability", async ({
  page,
}) => {
  const email = `adme-qa-d026ui-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID() + "Aa!";
  const anon = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { data } = await anon.auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role: "creator", name: "D026 UI" } },
  });
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/settings");
  await page
    .getByLabel("크리에이터 이름", { exact: true })
    .fill("다중 태그 검증");
  const cats = page.getByRole("group", { name: /분야/ }).getByRole("checkbox");
  await cats.nth(1).check();
  await page
    .getByRole("group", { name: "플랫폼" })
    .getByRole("checkbox", { name: "tiktok" })
    .check();
  await page.getByLabel("견적 미확인 (협의 후 결정)").check();
  await expect(page.getByLabel("최소 견적")).toHaveCount(0);
  await page.getByLabel("협업 의사").selectOption("unknown");
  await page.getByLabel("프로필 공개", { exact: true }).check();
  await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "저장했습니다" }),
  ).toBeVisible();

  await page.reload();
  await expect(cats.nth(0)).toBeChecked();
  await expect(cats.nth(1)).toBeChecked();
  await expect(page.getByLabel("견적 미확인 (협의 후 결정)")).toBeChecked();
  await expect(page.getByLabel("협업 의사")).toHaveValue("unknown");

  await page.goto(`/creators/user-${data.user!.id}`);
  await expect(page.getByText("견적 미확인").first()).toBeVisible();
  await expect(page.getByText("협업 의사 미확인").first()).toBeVisible();
  await expect(page.getByText("0원~")).toHaveCount(0);
});
