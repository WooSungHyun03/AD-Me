import { test, expect, type Page } from "@playwright/test";
import { createDiscoveryFixture } from "../support/discovery-fixture.mjs";
import { localAccounts, sql, totp } from "../support/local-qa.mjs";
import { resolve } from "node:path";
async function audit(page: Page) {
  await page.addScriptTag({
    path: resolve("node_modules/axe-core/axe.min.js"),
  });
  const issues = await page.evaluate(async () => {
    const result = await (
      window as unknown as {
        axe: {
          run: (options: unknown) => Promise<{
            violations: { id: string; nodes: { target: string[] }[] }[];
          }>;
        };
      }
    ).axe.run({
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
      },
    });
    return result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    }));
  });
  expect(issues).toEqual([]);
}
const accounts = localAccounts();
async function login(page: Page, role: string) {
  const a = accounts[role];
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(a.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  if (role === "admin") {
    await page.goto("/admin/security");
    await page
      .getByLabel("6자리 OTP", { exact: true })
      .fill(totp(a.totpSecret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }
}
test("ready P1 verified timeline, private rivals, missing-data graph and approved metric filter", async ({
  page,
  browser,
}, info) => {
  const f = await createDiscoveryFixture();
  try {
    await login(page, "brand");
    await page.goto("/creators/" + f.reference);
    await expect(page.getByTestId("public-ad-history")).toHaveCount(2);
    await page.getByLabel("광고 브랜드", { exact: true }).fill("화장품");
    await page.getByLabel("광고 카테고리", { exact: true }).fill("뷰티");
    await page
      .getByRole("button", { name: "광고 이력 검색", exact: true })
      .click();
    await expect(page.getByTestId("public-ad-history")).toHaveCount(1);
    await page.getByText("내 브랜드 경쟁사 목록", { exact: true }).click();
    await page
      .getByLabel("경쟁사 이름 · 한 줄에 하나", { exact: true })
      .fill("가상 화장품 브랜드");
    await page
      .getByRole("button", { name: "경쟁사 목록 저장", exact: true })
      .click();
    await expect(
      page.getByText("내 경쟁사 목록과 일치", { exact: true }),
    ).toBeVisible();
    const publicContext = await browser.newContext();
    const anonymous = await publicContext.newPage();
    await anonymous.goto("/creators/" + f.reference);
    await expect(
      anonymous.getByText("내 경쟁사 목록과 일치", { exact: true }),
    ).toHaveCount(0);
    await publicContext.close();
    const graph = page.getByTestId("metric-history");
    await expect(
      graph.getByText("가상 관측 기록 · approved_web · 가상 검증 자료 DEMO", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      graph.getByRole("cell", { name: "미확인", exact: true }),
    ).toBeVisible();
    await expect(
      graph.getByRole("cell", { name: "0", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `output/playwright/ready-discovery-${info.project.name}.png`,
      fullPage: true,
    });
    await audit(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await f.owner.rpc("review_withdraw", {
          p_id: f.cases[0],
          p_expected: 1,
        })
      ).error,
    ).toBeNull();
    await page
      .getByRole("button", { name: "광고 이력 검색", exact: true })
      .click();
    await expect(page.getByTestId("public-ad-history")).toHaveCount(0);
    await expect(
      page.getByText("검색 조건에 맞는 공개 검토 광고 0건", { exact: true }),
    ).toBeVisible();
    await page.goto("/creators");
    await page.getByLabel("크리에이터 검색", { exact: true }).fill(f.name);
    await expect(page.getByTestId("creator-card")).toHaveCount(1);
    await expect(
      page.getByLabel("최소 참여율 (%)", { exact: true }),
    ).toBeEnabled();
    await page.getByLabel("최소 참여율 (%)", { exact: true }).fill("0");
    await expect(page).toHaveURL(/minEngagement=0/);
    await expect(page.getByTestId("creator-card")).toHaveCount(1);
    await page.getByLabel("최소 참여율 (%)", { exact: true }).fill("1");
    await expect(page.getByTestId("creator-card")).toHaveCount(0);
    sql(
      `update adme_creator.publication_policies set enabled=false where policy_version='${f.policy}';`,
    );
    await page.reload();
    await expect(
      page.getByLabel("최소 참여율 (%)", { exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "참여율 조건 해제", exact: true })
      .click();
    await expect(page.getByTestId("creator-card")).toHaveCount(1);
  } finally {
    await f.cleanup();
  }
});
test("ready P1 native admin MFA, scoped paginated search and exact audit receipt", async ({
  page,
}, info) => {
  await login(page, "brand");
  const denied = await page.request.post("/api/admin/search", {
    data: { kind: "members", reason: "가상 권한 검사" },
  });
  expect(denied.status()).toBe(403);
  await login(page, "admin");
  await page
    .getByRole("combobox", { name: "운영 검색 대상", exact: true })
    .selectOption("creators");
  await page
    .getByLabel("조회 사유", { exact: true })
    .fill("가상 사용자 문의 확인 " + info.project.name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/admin/search") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "운영 검색", exact: true }).click();
  const res = await response;
  expect(res.status()).toBe(200);
  const requestId = res.headers()["x-request-id"];
  expect(
    sql(
      `select request_id::text from adme_ops.support_audit where request_id='${requestId}';`,
    ),
  ).toBe(requestId);
  await expect(page.getByTestId("admin-record")).toHaveCount(20);
  await page
    .getByRole("button", { name: "다음 운영 결과", exact: true })
    .click();
  await expect
    .poll(() => page.getByTestId("admin-record").count())
    .toBeGreaterThan(20);
  await page
    .getByRole("combobox", { name: "운영 검색 대상", exact: true })
    .selectOption("jobs");
  await page.getByRole("button", { name: "운영 검색", exact: true }).click();
  await expect(page.getByTestId("admin-search-results")).toContainText(
    "수집 작업",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/ready-admin-${info.project.name}.png`,
    fullPage: true,
  });
  await audit(page);
});
