// D011: role-specific onboarding steps derived from DB rows only — progress survives an interrupted
// signup and re-login, finishing a step updates the checklist, and a user can never grant itself a role.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect, type Page } from "@playwright/test";
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
const anon = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );
async function signup(role: string, name = "온보딩 검증") {
  const email = `adme-qa-onboard-${randomUUID().slice(0, 8)}@example.com`,
    password = randomUUID() + "Aa!";
  const db = anon();
  const r = await db.auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role, name } },
  });
  expect(r.error).toBeNull();
  return { db, email, password, id: r.data.user!.id };
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("brand: interrupted onboarding resumes after re-login and completes with the first brief", async ({
  page,
  browser,
}) => {
  const b = await signup("brand");
  // Signup stopped right after account creation: the first sign-in shows where to continue.
  await login(page, b.email, b.password);
  const steps = page.locator(".notice", { hasText: "시작하기" });
  await expect(steps).toContainText("시작하기 1/2");
  await expect(steps).toContainText("✓ 계정 표시 이름 설정");
  await expect(
    steps.getByRole("link", { name: "첫 캠페인 브리프 작성 이어서 하기 →" }),
  ).toHaveAttribute("href", "/campaigns/new");

  // Re-entry from a fresh session shows the same progress (derived from DB rows, not client state).
  const other = await browser.newContext();
  const again = await other.newPage();
  await login(again, b.email, b.password);
  await expect(again.locator(".notice", { hasText: "시작하기" })).toContainText(
    "시작하기 1/2",
  );
  await other.close();

  const made = await page.request.post("/api/campaigns", {
    data: {
      title: `온보딩 첫 브리프 ${Date.now()}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["youtube"],
      budget_krw: 1000000,
      target_audience: "20대",
      goal: "온보딩 완료 검증",
      status: "draft",
    },
  });
  expect(made.status()).toBe(201);
  await page.reload();
  await expect(page.locator(".notice", { hasText: "시작하기" })).toHaveCount(0);
});

test("creator: steps are role-specific and roles cannot be self-assigned", async ({
  page,
}) => {
  const c = await signup("creator", "새 사용자");
  await login(page, c.email, c.password);
  const steps = page.locator(".notice", { hasText: "시작하기" });
  await expect(steps).toContainText("시작하기 0/3");
  for (const label of [
    "계정 표시 이름 설정",
    "크리에이터 프로필 작성",
    "프로필 공개",
  ])
    await expect(
      steps.getByRole("link", { name: `${label} 이어서 하기 →` }),
    ).toBeVisible();
  await expect(steps).not.toContainText("캠페인 브리프");

  // Direct role tampering: neither the profile row nor signup metadata can grant admin or switch role.
  const tamper = await c.db
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", c.id);
  const role = (
    await c.db.from("profiles").select("role").eq("id", c.id).single()
  ).data?.role;
  expect(tamper.error !== null || role === "creator").toBe(true);
  expect(role).toBe("creator");
  const forged = await signup("admin");
  expect(
    (
      await forged.db
        .from("profiles")
        .select("role")
        .eq("id", forged.id)
        .single()
    ).data?.role,
  ).toBe("brand");
  // The admin area stays closed to the tampering account.
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "관리자 권한이 필요합니다." }),
  ).toBeVisible();
  await expect(page.getByTestId("admin-search-results")).toHaveCount(0);
});
