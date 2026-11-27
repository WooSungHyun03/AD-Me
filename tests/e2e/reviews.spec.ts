import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import {
  localAccounts,
  localRuntime,
  sql,
  totp,
} from "../support/local-qa.mjs";
import {
  createReviewBrowserCreator,
  restoreReviewPolicy,
} from "../support/review-browser-fixtures.mjs";
const accounts = localAccounts();
async function login(
  page: Page,
  who: string | { email: string; password: string },
) {
  const c = typeof who === "string" ? accounts[who] : who;
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(c.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(c.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  if (who === "admin") {
    await page.goto("/admin/security");
    await page
      .getByLabel("6자리 OTP", { exact: true })
      .fill(totp(c.totpSecret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }
}
const panel = (page: Page, id: string) =>
  page.locator(`[data-review-id="${id}"]`);
async function prepareDecision(
  page: Page,
  id: string,
  classification: string,
  summary: string,
) {
  const p = panel(page, id);
  await p.getByText("근거 검토·공개 판정", { exact: true }).click();
  await p.getByLabel("사실 구분").selectOption(classification);
  await p
    .getByLabel("비공개 검토 근거")
    .fill("INTERNAL_BROWSER_FIXTURE_NOTE_ONLY");
  await p.getByLabel("공개할 검토 요약").fill(summary);
  await p.locator('input[name="publish"]').check();
  return p;
}
test("evidence review preserves private allegations and position, rejects stale UI review and publishes only current curated facts", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const fixture = await createReviewBrowserCreator(),
    ids: string[] = [],
    policy = JSON.parse(
      sql("select to_jsonb(p)::text from adme_review.policy p;"),
    );
  const ownerContext = await browser.newContext(),
    owner = await ownerContext.newPage(),
    adminContext = await browser.newContext(),
    admin = await adminContext.newPage(),
    publicContext = await browser.newContext(),
    publicPage = await publicContext.newPage();
  try {
    sql("update adme_review.policy set enabled=false where singleton;");
    await login(page, "brand");
    await page.goto(`/reports/new?creator=${fixture.creatorId}`);
    const marker = `PRIVATE_BROWSER_ORIGINAL_${randomUUID().slice(0, 8)}`;
    await page.getByLabel("정정·신고 사유").fill(marker);
    await page
      .getByLabel("확인 가능한 출처 URL")
      .fill("https://example.test/fictional-review-ui");
    await page.getByLabel("자료 구분").selectOption("source");
    const posted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/reports") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "비공개 검토 요청" }).click();
    const post = await posted;
    expect(post.status()).toBe(200);
    const id = (await post.json()).id;
    ids.push(id);
    await expect(page.getByRole("status")).toContainText("접수되었습니다");
    expect(
      await (
        await publicPage.request.get(
          `/api/reviews/public?creatorId=${fixture.creatorId}`,
        )
      ).json(),
    ).toEqual([]);
    await page.goto("/reports");
    const submitted = panel(page, id);
    await submitted.getByText("제출 내용 정정", { exact: true }).click();
    await submitted
      .getByLabel("정정 내용")
      .fill(marker + " 정정된 가상 내용입니다.");
    await submitted.getByRole("button", { name: "새 버전 제출" }).click();
    await expect(
      submitted.getByText("버전 2", { exact: true }).first(),
    ).toBeVisible();
    await login(admin, "admin");
    await admin.goto("/admin/reviews");
    await prepareDecision(
      admin,
      id,
      "confirmed_fact",
      "가상 출처에서 확인한 공개 자료 요약입니다.",
    );
    await login(owner, fixture);
    await owner.goto("/reports");
    const target = panel(owner, id);
    await target.getByText("당사자 입장 제출", { exact: true }).click();
    await target
      .getByLabel("당사자 답변")
      .fill("PRIVATE_BROWSER_OWNER_POSITION_FIXTURE");
    await target
      .getByRole("button", { name: "입장 제출", exact: true })
      .click();
    await expect(
      target.getByText("버전 3", { exact: true }).first(),
    ).toBeVisible();
    const old = admin.waitForResponse((r) =>
      r.url().endsWith("/api/admin/reviews"),
    );
    await panel(admin, id)
      .getByRole("button", { name: "검토 판정 저장" })
      .click();
    expect((await old).status()).toBe(409);
    const beforePolicy = await admin.request.post("/api/admin/reviews", {
      data: {
        id,
        expectedVersion: 3,
        verdict: "approved",
        classification: "confirmed_fact",
        note: "가상 출처 자료를 확인한 검토 근거입니다.",
        summary: "가상 출처에서 확인한 공개 자료 요약입니다.",
        publish: true,
      },
    });
    expect(beforePolicy.status()).toBe(422);
    sql(
      "update adme_review.policy set enabled=true,version='fixture-browser-issue-v1',approval_ref='https://example.test/fixture-browser-policy' where singleton;",
    );
    await admin.reload();
    await prepareDecision(
      admin,
      id,
      "confirmed_fact",
      "가상 출처에서 확인한 공개 자료 요약입니다.",
    );
    await panel(admin, id)
      .getByRole("button", { name: "검토 판정 저장" })
      .click();
    await expect(
      panel(admin, id).getByText("검토 승인", { exact: true }),
    ).toBeVisible();
    const response = await publicPage.goto(`/creators/${fixture.creatorId}`),
      html = await response!.text();
    for (const value of [
      marker,
      "PRIVATE_BROWSER_OWNER_POSITION_FIXTURE",
      "INTERNAL_BROWSER_FIXTURE_NOTE_ONLY",
    ])
      expect(html).not.toContain(value);
    await expect(publicPage.getByTestId("public-review")).toHaveCount(1);
    await expect(publicPage.getByTestId("public-review")).toContainText("DEMO");
    await publicPage.getByTestId("public-review").screenshot({
      path: `output/playwright/review-public-${info.project.name}.png`,
    });
    await panel(admin, id).screenshot({
      path: `output/playwright/review-admin-${info.project.name}.png`,
    });
    await page.goto("/reports");
    await panel(page, id)
      .getByRole("button", { name: "검토 요청 철회" })
      .click();
    await expect(
      panel(page, id).getByText("철회", { exact: true }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByTestId("public-review")).toHaveCount(0);
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await ownerContext.close();
    await adminContext.close();
    await publicContext.close();
    await fixture.cleanup(ids);
    restoreReviewPolicy(policy);
    // Deleting the report does not refund the brand's submit quota; reruns would hit 429.
    sql(
      `delete from adme_ops.rate_windows where scope like 'review_submit_%' and subject='${accounts.brand.id}';`,
    );
  }
});
test("owner ad history submission, review and correction keep brand mentions private and bind approval to a version", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const fixture = await createReviewBrowserCreator(),
    ids: string[] = [],
    policy = JSON.parse(
      sql("select to_jsonb(p)::text from adme_review.policy p;"),
    );
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage(),
    publicContext = await browser.newContext(),
    publicPage = await publicContext.newPage();
  try {
    sql("update adme_review.policy set ad_enabled=false where singleton;");
    await login(page, fixture);
    await page.goto("/ad-history/new");
    const label = `가상 광고 브랜드 ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("광고 브랜드명").fill(label);
    await page.getByLabel("광고 분야").fill("교육");
    await page.getByLabel("광고 형식").fill("숏폼");
    await page.getByLabel("광고 시작일").fill("2025-01-01");
    await page.getByLabel("광고 종료일").fill("2025-01-31");
    await page
      .getByRole("combobox", { name: "경제적 이해관계", exact: true })
      .selectOption("paid");
    await page.getByLabel("이해관계 표시 확인").selectOption("visible");
    await page
      .getByLabel("광고 근거 종류")
      .selectOption("official_confirmation");
    await page
      .getByLabel("광고 근거 URL")
      .fill(`https://example.test/fictional-ad-ui/${randomUUID()}`);
    await page.locator('input[name="ownershipConfirmed"]').check();
    const posted = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/ad-history") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "광고 이력 검토 요청" }).click();
    const response = await posted;
    expect(response.status()).toBe(200);
    const id = (await response.json()).id;
    ids.push(id);
    await expect(page).toHaveURL(/\/reports$/);
    await expect(
      panel(page, id).getByRole("heading", { name: label, exact: true }),
    ).toBeVisible();
    expect(
      await (
        await publicPage.request.get(
          `/api/ad-history?creatorId=${fixture.creatorId}`,
        )
      ).json(),
    ).toEqual([]);
    await login(admin, "admin");
    const blocked = await admin.request.post("/api/admin/reviews", {
      data: {
        id,
        expectedVersion: 1,
        verdict: "approved",
        classification: "ad_evidence",
        note: "가상 광고 근거 자료 검토입니다.",
        summary: "가상 광고 근거를 확인한 운영 검토입니다.",
        publish: true,
      },
    });
    expect(blocked.status()).toBe(422);
    sql(
      "update adme_review.policy set ad_enabled=true,ad_version='fixture-browser-ad-v1',ad_approval_ref='https://example.test/fixture-ad-policy' where singleton;",
    );
    await admin.goto("/admin/reviews");
    await prepareDecision(
      admin,
      id,
      "ad_evidence",
      "가상 광고 근거를 확인한 운영 검토입니다.",
    );
    await panel(admin, id)
      .getByRole("button", { name: "검토 판정 저장" })
      .click();
    await expect(
      panel(admin, id).getByText("검토 승인", { exact: true }),
    ).toBeVisible();
    await publicPage.goto(`/creators/${fixture.creatorId}`);
    await expect(publicPage.getByTestId("public-ad-history")).toContainText(
      label,
    );
    await expect(publicPage.getByTestId("public-ad-history")).toContainText(
      "DEMO",
    );
    await page.reload();
    const own = panel(page, id);
    await own.getByText("제출 내용 정정", { exact: true }).click();
    await own.getByLabel("광고 브랜드명").fill(label + " 정정");
    await own.locator('input[name="ownershipConfirmed"]').check();
    await own.getByRole("button", { name: "새 버전 제출" }).click();
    await expect(
      own.getByText("버전 2", { exact: true }).first(),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByTestId("public-ad-history")).toHaveCount(0);
    const stale = await admin.request.post("/api/admin/reviews", {
      data: {
        id,
        expectedVersion: 1,
        verdict: "approved",
        classification: "ad_evidence",
        note: "가상 구버전 승인 요청입니다.",
        summary: "구버전 승인으로 새 내용을 확정하지 않습니다.",
        publish: true,
      },
    });
    expect(stale.status()).toBe(409);
    await admin.reload();
    await prepareDecision(
      admin,
      id,
      "ad_evidence",
      "정정된 가상 광고 근거를 확인한 운영 검토입니다.",
    );
    await panel(admin, id)
      .getByRole("button", { name: "검토 판정 저장" })
      .click();
    await expect(
      panel(admin, id).getByText("검토 승인", { exact: true }),
    ).toBeVisible();
    await publicPage.reload();
    await expect(publicPage.getByTestId("public-ad-history")).toContainText(
      label + " 정정",
    );
    await publicPage.getByTestId("public-ad-history").screenshot({
      path: `output/playwright/ad-history-public-${info.project.name}.png`,
    });
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await adminContext.close();
    await publicContext.close();
    await fixture.cleanup(ids);
    restoreReviewPolicy(policy);
    // Deleting the report does not refund the brand's submit quota; reruns would hit 429.
    sql(
      `delete from adme_ops.rate_windows where scope like 'review_submit_%' and subject='${accounts.brand.id}';`,
    );
  }
});
