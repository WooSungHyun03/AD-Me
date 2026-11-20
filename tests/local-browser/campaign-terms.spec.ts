import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { sql, localRuntime } from "../support/local-qa.mjs";
import { fillCampaignTerms } from "../support/campaign-terms-form";
const a = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(a.brand.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(a.brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("structured campaign terms persist KST/UTC, product/mixed/unknown and edit rows without changing recruitment status", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  let id: string | undefined;
  try {
    await login(page);
    if (process.env.ADME_QA_FREE === "1") {
      await page.goto("/pricing");
      await expect(
        page.getByRole("heading", { name: "무료 베타", exact: true }),
      ).toBeVisible();
      expect(
        (await page.request.post("/api/billing/orders", { data: {} })).status(),
      ).toBe(404);
    }
    await page.goto("/campaigns/new");
    await page
      .getByLabel("캠페인 이름", { exact: true })
      .fill(`QA 가상 제품 캠페인 ${randomUUID().slice(0, 8)}`);
    await page.getByLabel("상품·서비스", { exact: true }).fill("가상 QA 제품");
    await page.getByLabel("타깃 고객", { exact: true }).fill("로컬 성인 QA");
    await page
      .getByLabel("광고 목적", { exact: true })
      .fill("구조화 조건 검증");
    await fillCampaignTerms(page);
    await page
      .getByRole("combobox", { name: "제공 유형", exact: true })
      .selectOption("product");
    await page.getByLabel("제공 제품", { exact: true }).fill("가상 샘플 제품");
    await page.getByLabel("제공 제품 수량", { exact: true }).fill("2");
    await page
      .getByLabel("공개 상태", { exact: true })
      .selectOption("published");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/campaign-terms-form-${info.project.name}.png`,
      fullPage: true,
    });
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/campaigns") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
    await expect(
      page.getByText("가상 크리에이터 · DEMO", { exact: true }),
    ).toHaveCount(6);
    await expect(
      page.getByRole("region", { name: "기록된 협업 조건" }),
    ).toContainText("제품 제공: 가상 샘플 제품 · 2개");
    expect(
      JSON.parse(
        sql(`select brief::text from public.campaigns where id='${id}';`),
      ).terms.recruitment.start,
    ).toBe("2026-12-31T15:15:00.000Z");
    const anon = await browser.newContext({ ignoreHTTPSErrors: true });
    try {
      const publicPage = await anon.newPage();
      await publicPage.goto(`/campaigns/${id}`);
      await expect(
        publicPage.getByRole("region", { name: "기록된 협업 조건" }),
      ).toContainText("가상 샘플 제품");
    } finally {
      await anon.close();
    }
    await page.goto(`/campaigns/${id}/edit`);
    await expect(
      page.getByLabel("모집 시작 (KST)", { exact: true }),
    ).toHaveValue("2027-01-01T00:15");
    await page
      .getByRole("combobox", { name: "제공 유형", exact: true })
      .selectOption("mixed");
    await page.getByLabel("최소 현금 단가 (원)", { exact: true }).fill("0");
    await page.getByLabel("최대 현금 단가 (원)", { exact: true }).fill("50000");
    await page
      .getByRole("button", { name: "산출물 추가", exact: true })
      .click();
    await page.getByLabel("산출물 2 형식", { exact: true }).fill("제품 리뷰");
    await page.getByLabel("산출물 2 수량", { exact: true }).fill("2");
    await page
      .getByLabel("산출물 2 사용권", { exact: true })
      .fill("가상 홈페이지에서 7일 게시");
    await page
      .getByLabel("산출물 2 독점 조건 (선택)", { exact: true })
      .fill("동종 카테고리 7일");
    await page
      .getByRole("button", { name: "산출물 추가", exact: true })
      .click();
    await page
      .getByRole("button", { name: "산출물 3 삭제", exact: true })
      .click();
    await expect(
      page.getByLabel("산출물 2 사용권", { exact: true }),
    ).toHaveValue("가상 홈페이지에서 7일 게시");
    await page
      .getByLabel("모집 종료 (KST)", { exact: true })
      .fill("2026-12-01T09:00");
    let writes = 0;
    const observe = (r: { url: () => string; method: () => string }) => {
      if (r.url().endsWith("/api/campaigns") && r.method() === "PATCH")
        writes++;
    };
    page.on("request", observe);
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "일정 순서" }),
    ).toContainText("일정 순서");
    expect(writes).toBe(0);
    page.off("request", observe);
    await page
      .getByLabel("모집 종료 (KST)", { exact: true })
      .fill("2027-01-10T18:00");
    const updated = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/campaigns") && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    expect((await updated).status()).toBe(200);
    await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
    await expect(
      page.getByRole("region", { name: "기록된 협업 조건" }),
    ).toContainText("현금 단가 0원 ~ 50,000원");
    await expect(
      page.getByRole("region", { name: "기록된 협업 조건" }),
    ).toContainText("동종 카테고리 7일");
    await page.screenshot({
      path: `output/playwright/campaign-terms-detail-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto(`/campaigns/${id}/edit`);
    await page
      .getByRole("combobox", { name: "제공 유형", exact: true })
      .selectOption("unknown");
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
    await page.reload();
    await expect(
      page.getByRole("region", { name: "기록된 협업 조건" }),
    ).toContainText("보상 조건 미정");
    const stored = JSON.parse(
      sql(
        `select json_build_object('status',status,'brief',brief)::text from public.campaigns where id='${id}';`,
      ),
    );
    expect(stored.status).toBe("published");
    expect(stored.brief.terms.compensation).toEqual({ mode: "unknown" });
    expect(stored.brief.terms.deliverables).toHaveLength(2);
  } finally {
    if (id) sql(`delete from public.campaigns where id='${id}';`);
  }
});
test("legacy campaigns show missing structured terms and can be upgraded without silent loss", async ({
  page,
}) => {
  localRuntime();
  let id: string | undefined;
  try {
    await login(page);
    const brief = {
      title: "QA 가상 이전 버전 캠페인",
      product: "가상 제품",
      category: "교육",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 100000,
      target_audience: "로컬 QA",
      goal: "이전 버전 호환",
      status: "draft",
    };
    const created = await page.request.post("/api/campaigns", { data: brief });
    expect(created.status()).toBe(201);
    id = (await created.json()).id;
    await page.goto(`/campaigns/${id}`);
    await expect(
      page.getByText(
        "이전 버전 캠페인 · 기간·제공 조건·산출물이 구조화되어 있지 않습니다.",
        { exact: true },
      ),
    ).toBeVisible();
    await page.goto(`/campaigns/${id}/edit`);
    await expect(
      page.getByLabel("일정·제공 조건·산출물 추가"),
    ).not.toBeChecked();
    await page.getByLabel("광고 목적", { exact: true }).fill("기존 값 보존");
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
    expect(
      JSON.parse(
        sql(`select brief::text from public.campaigns where id='${id}';`),
      ),
    ).not.toHaveProperty("terms");
    await page.goto(`/campaigns/${id}/edit`);
    await page.getByLabel("일정·제공 조건·산출물 추가").check();
    await fillCampaignTerms(page);
    await page.getByRole("button", { name: "캠페인 저장" }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${id}$`));
    await expect(
      page.getByRole("region", { name: "기록된 협업 조건" }),
    ).toContainText("보상 조건 미정");
    const oldClient = await page.request.patch("/api/campaigns", {
      data: { id, brief },
    });
    expect(oldClient.status()).toBe(422);
    expect(
      JSON.parse(
        sql(`select brief::text from public.campaigns where id='${id}';`),
      ),
    ).toHaveProperty("terms.version", 2);
  } finally {
    if (id) sql(`delete from public.campaigns where id='${id}';`);
  }
});
