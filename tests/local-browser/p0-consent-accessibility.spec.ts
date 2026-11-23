import { test, expect, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { localRuntime, sql, totp } from "../support/local-qa.mjs";
import { createReviewBrowserCreator } from "../support/review-browser-fixtures.mjs";
type AxeIssue = { id: string; impact: string; nodes: { target: string[] }[] };
const roleAccounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
) as Record<string, { email: string; password: string; totpSecret?: string }>;
async function audit(page: Page) {
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.addScriptTag({
    path: resolve("node_modules/axe-core/axe.min.js"),
  });
  return page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: { run: (options: unknown) => Promise<{ violations: AxeIssue[] }> };
      }
    ).axe.run({
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
      },
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target),
    }));
  });
}
async function login(page: Page, a: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(a.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("P0 public flow axe, keyboard skip, reduced motion and 320/390/768/1440 layouts", async ({
  page,
}, info) => {
  localRuntime();
  const paths = [
    "/",
    "/login",
    "/signup",
    "/signup/resend",
    "/forgot-password",
    "/privacy",
    "/terms",
    "/pricing",
    "/creators",
    "/campaigns",
    "/tools",
    "/creators/creator-001",
    "/does-not-exist-qa",
  ];
  const results = [];
  for (const path of paths) {
    await page.goto(path);
    const issues = await audit(page);
    results.push({ path, issues });
    expect.soft(issues, `${path} WCAG`).toEqual([]);
  }
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/signup", "/privacy", "/creators", "/terms"]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${path}@${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({
    width: info.project.name === "mobile" ? 390 : 1440,
    height: 900,
  });
  await page.goto("/signup");
  for (const label of [
    "이용약관에 동의합니다",
    "개인정보 처리 안내를 확인했습니다",
    "만 19세 이상 성인임을 확인합니다",
  ])
    await expect(page.getByLabel(label, { exact: false })).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "본문으로 이동", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/p0-next-signup-${info.project.name}.png`,
    fullPage: true,
  });
  await info.attach("axe-public-summary", {
    body: JSON.stringify(results),
    contentType: "application/json",
  });
});
test("P0 own consent history, lost acknowledgement retry, optional withdrawal and form error focus", async ({
  page,
}, info) => {
  const actor = await createReviewBrowserCreator();
  try {
    await login(page, actor);
    await page.goto("/settings");
    const consentPanel = page.locator(".panel").filter({
      has: page.getByRole("heading", {
        name: "확인 기록과 공개 선택",
        exact: true,
      }),
    });
    await page
      .getByRole("button", { name: "내 확인 기록 보기", exact: true })
      .click();
    await expect(
      page.getByText("이용약관 · 확인·동의", { exact: false }),
    ).toBeVisible();
    expect(await audit(page)).toEqual([]);
    let dropped = false;
    const keys: string[] = [];
    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "POST") {
        keys.push(route.request().postDataJSON().requestKey);
        if (!dropped) {
          dropped = true;
          const r = await route.fetch();
          expect(r.status()).toBe(200);
          await route.abort("connectionreset");
          return;
        }
      }
      await route.continue();
    });
    await page
      .getByRole("button", { name: "선택적 프로필 공개 철회", exact: true })
      .click();
    await expect(consentPanel.getByRole("alert")).toContainText(
      "같은 요청으로 다시",
    );
    await page
      .getByRole("button", { name: "선택적 프로필 공개 철회", exact: true })
      .click();
    await expect(consentPanel.getByRole("status")).toContainText(
      "선택적 공개를 철회했습니다",
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByLabel("프로필 공개", { exact: true }),
    ).not.toBeChecked();
    await expect(page.locator('input[name="owner_consent"]')).not.toBeChecked();
    await page
      .getByRole("button", { name: "프로필 저장", exact: true })
      .click();
    await expect(
      page.getByText("프로필을 저장했습니다.", { exact: true }),
    ).toBeVisible();
    expect(
      sql(
        `select published from public.creators where owner_id='${actor.id}';`,
      ),
    ).toBe("f");
    expect(
      sql(
        `select count(*) from adme_consent.events where actor_id='${actor.id}' and purpose='profile_publication' and scope='global';`,
      ),
    ).toBe("1");
    const publicResult = await page.request.get(`/creators/${actor.creatorId}`);
    await expect(consentPanel.getByRole("status")).toContainText(
      "계정·파일 전체 삭제는 별도",
    );
    expect(await publicResult.text()).not.toContain(
      "크리에이터 YouTube 동영상",
    );
    await page.screenshot({
      path: `output/playwright/p0-next-consent-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto("/login");
    await page
      .getByLabel("이메일", { exact: true })
      .fill("invalid-fixture@example.test");
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill("invalid-fixture-password");
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toBeFocused();
  } finally {
    await actor.cleanup([]);
  }
});

test("P0 authenticated brand creator and MFA admin main flows pass axe", async ({
  page,
}, info) => {
  localRuntime();
  const results = [];
  for (const [role, paths] of Object.entries({
    brand: [
      "/dashboard",
      "/settings",
      "/campaigns/new",
      "/reports/new",
      "/creators",
    ],
    creator: [
      "/dashboard",
      "/settings",
      "/settings/youtube",
      "/ad-history/new",
    ],
    admin: ["/admin", "/admin/intelligence", "/admin/reviews"],
  })) {
    await login(page, roleAccounts[role]);
    if (role === "admin") {
      await page.goto("/admin/security");
      await page
        .getByLabel("6자리 OTP", { exact: true })
        .fill(totp(roleAccounts.admin.totpSecret!));
      await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
      await expect(page).toHaveURL(/\/admin$/);
    }
    for (const path of paths) {
      await page.goto(path);
      expect.soft(new URL(page.url()).pathname).toBe(path);
      const issues = await audit(page);
      results.push({ role, path, issues });
      expect.soft(issues, role + ":" + path).toEqual([]);
      expect
        .soft(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        )
        .toBe(true);
    }
  }
  await info.attach("axe-role-summary", {
    body: JSON.stringify(results),
    contentType: "application/json",
  });
});
