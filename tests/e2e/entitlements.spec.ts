// D069: admin grants a TEST entitlement with a mandatory reason; the member sees it; revoke recovers it.
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("admin manual grant needs a reason; member sees it; revoke removes it", async ({
  page,
  browser,
}, info) => {
  expect(env.NEXT_PUBLIC_SUPABASE_URL).toMatch(
    /^http:\/\/(127\.0\.0\.1|localhost):/,
  );
  const svc = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const tag = `${info.project.name}${Date.now()}`;
  const acc = { email: `ent-${tag}@example.test`, password: "Ent-Brand-2026!" };
  const uid = (
    await svc.auth.admin.createUser({
      ...acc,
      email_confirm: true,
      user_metadata: { role: "brand", name: `이용권 ${tag}` },
    })
  ).data.user!.id;
  sql(
    `update profiles set role = 'brand', name = '이용권 ${tag}' where id = '${uid}'`,
  );
  try {
    await login(page, accounts.admin);
    await page.goto("/admin");
    await page.getByText("이용권 수동 발급 (사유 필수)").click();
    const form = page.getByRole("form", { name: "이용권 수동 발급" });
    await form
      .getByLabel("회원")
      .selectOption({ label: `이용권 ${tag} (brand)` });
    await form.getByLabel("상품").selectOption("ai_credits");
    await form.getByLabel("크레딧").fill("7");
    // Reason is required by the server too.
    expect(
      (
        await page.request.post("/api/admin/entitlements", {
          data: {
            action: "grant",
            owner: uid,
            sku: "ai_credits",
            days: 30,
            credits: 7,
            note: "",
          },
        })
      ).status(),
    ).toBe(400);
    await form
      .getByLabel("발급 사유 (필수, 감사 기록)")
      .fill(`E2E 보상 ${tag}`);
    await form.getByRole("button", { name: "TEST 이용권 발급" }).click();
    await expect(form.getByRole("status")).toHaveText("발급했습니다.");
    const row = page
      .getByTestId("admin-entitlement")
      .filter({ hasText: `E2E 보상 ${tag}` });
    await expect(row).toContainText("유효");
    await expect(row).toContainText("크레딧 7");

    const ctx = await browser.newContext();
    const mp = await ctx.newPage();
    await login(mp, acc);
    await expect(mp.getByText(/ai_credits .*잔여 크레딧 7/)).toBeVisible();
    // A member cannot grant themselves anything.
    expect(
      (
        await mp.request.post("/api/admin/entitlements", {
          data: {
            action: "grant",
            owner: uid,
            sku: "ai_credits",
            days: 30,
            credits: 999,
            note: "자가 발급 시도",
          },
        })
      ).status(),
    ).toBe(403);

    await expect(row.getByRole("button", { name: "회수" })).toBeDisabled();
    await row.getByLabel("회수 사유").fill(`E2E 회수 ${tag}`);
    await row.getByRole("button", { name: "회수" }).click();
    await expect(row).toContainText("회수됨");
    await expect(row).toContainText("크레딧 0");
    await mp.reload();
    await expect(mp.getByText(/ai_credits .*잔여 크레딧/)).toHaveCount(0);
    await ctx.close();
  } finally {
    sql(`delete from entitlements where owner_id = '${uid}'`);
    await svc.auth.admin.deleteUser(uid);
  }
});
