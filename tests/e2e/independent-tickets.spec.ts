import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { localAccounts, localRuntime, sql } from "../support/local-qa.mjs";
import { campaignBriefTermsSchema } from "@/lib/campaign-brief";
const accounts = localAccounts();
async function login(page: Page, role = "brand") {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function a11y(page: Page) {
  await page.addScriptTag({
    path: resolve("node_modules/axe-core/axe.min.js"),
  });
  const violations = await page.evaluate(
    async () =>
      (
        await (
          window as unknown as {
            axe: {
              run: (v: unknown) => Promise<{
                violations: { id: string; nodes: { target: string[] }[] }[];
              }>;
            };
          }
        ).axe.run({
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"],
          },
        })
      ).violations,
  );
  expect(violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
const terms = campaignBriefTermsSchema.parse({
  version: 2,
  recruitment: { start: "2027-01-01T00:00", end: "2027-01-02T00:00" },
  production: { start: "2027-01-02T00:00", end: "2027-01-03T00:00" },
  posting: { start: "2027-01-03T00:00", end: "2027-01-04T00:00" },
  compensation: { mode: "unknown" },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "가상 QA 소개",
      exclusivity: null,
    },
  ],
});
test("independent D042/D055: owner copies a draft and downloads private UTC calendar; other roles denied", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const ids: string[] = [];
  try {
    await login(page);
    const created = await page.request.post("/api/campaigns", {
      data: {
        title: "가상 독립 복제 QA",
        product: "가상 제품",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["instagram"],
        budget_krw: 100000,
        target_audience: "성인 고객",
        goal: "가상 QA 소개",
        status: "draft",
        terms,
      },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    ids.push(id);
    const calendar = await page.request.get(`/api/campaigns/${id}/calendar`);
    expect(calendar.status()).toBe(200);
    expect(calendar.headers()["cache-control"]).toBe("private, no-store");
    expect(await calendar.text()).toContain("DTSTART:20261231T150000Z");
    await page.goto(`/campaigns/${id}/copy`);
    await expect(
      page.getByRole("heading", {
        name: "새 캠페인 초안으로 복제",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("캠페인 이름", { exact: true })).toHaveValue(
      "가상 독립 복제 QA (복제)",
    );
    await expect(page.getByLabel("공개 상태", { exact: true })).toHaveValue(
      "draft",
    );
    await a11y(page);
    await page.screenshot({
      path: `output/playwright/independent-copy-${info.project.name}.png`,
      fullPage: true,
    });
    const saved = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/campaigns") && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "캠페인 저장 →", exact: true })
      .click();
    const response = await saved;
    expect(response.status()).toBe(201);
    const copy = (await response.json()).id;
    ids.push(copy);
    expect(copy).not.toBe(id);
    await expect(page).toHaveURL(new RegExp(`/campaigns/${copy}$`));
    await expect(
      page.getByRole("link", { name: "캠페인 일정 다운로드", exact: true }),
    ).toBeVisible();
    expect(
      sql(
        `select status from public.campaigns where id='${copy}' and owner_id='${accounts.brand.id}';`,
      ),
    ).toBe("draft");
    const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const other = await otherContext.newPage();
    try {
      await login(other, "other");
      await other.goto(`/campaigns/${id}/copy`);
      await expect(
        other.getByRole("heading", {
          name: "찾으시는 페이지가 없습니다.",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        other.getByLabel("캠페인 이름", { exact: true }),
      ).toHaveCount(0);
      expect(
        (await other.request.get(`/api/campaigns/${id}/calendar`)).status(),
      ).toBe(404);
    } finally {
      await otherContext.close();
    }
    const creatorContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    });
    const creator = await creatorContext.newPage();
    try {
      await login(creator, "creator");
      expect(
        (await creator.request.get(`/api/campaigns/${id}/calendar`)).status(),
      ).toBe(403);
    } finally {
      await creatorContext.close();
    }
  } finally {
    if (ids.length)
      sql(
        `delete from public.campaigns where owner_id='${accounts.brand.id}'and id in(${ids.map((id) => `'${id}'`).join(",")});`,
      );
  }
});
test("independent D039/D037: confirm before applying filters; persist, reopen, CAS update and remove private conditions", async ({
  page,
}, info) => {
  localRuntime();
  let savedId: string | undefined;
  try {
    await login(page);
    await page.goto("/creators");
    await page
      .getByText("문장으로 검색 조건 제안받기", { exact: true })
      .click();
    await page
      .getByLabel("검색 문장", { exact: true })
      .fill("유튜브 뷰티 팔로워 1만명 이상 예산 100만원 이하"); // sentence search is YouTube-only; other platforms are refused
    await page
      .getByRole("button", { name: "조건 제안 확인", exact: true })
      .click();
    expect(new URL(page.url()).searchParams.has("minFollowers")).toBe(false);
    await expect(
      page.getByRole("region", { name: "검색 조건 제안", exact: true }),
    ).toContainText("1만명 이상");
    await a11y(page);
    await page
      .getByRole("button", { name: "확인한 조건 적용", exact: true })
      .click();
    await expect(page).toHaveURL(/minFollowers=10000/);
    await page
      .getByRole("link", { name: "현재 조건 저장·내 저장 검색", exact: true })
      .click();
    const name = `가상 QA ${info.project.name} ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("저장 검색 이름", { exact: true }).fill(name);
    const stored = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/saved-searches") &&
        r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "현재 조건 저장", exact: true })
      .click();
    expect((await stored).status()).toBe(200);
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    const records = await (
      await page.request.get("/api/saved-searches")
    ).json();
    savedId = records.find((r: { name: string }) => r.name === name).id;
    await a11y(page);
    await page.screenshot({
      path: `output/playwright/independent-saved-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(/minFollowers=10000/);
    await page.goto("/saved-searches?maxPrice=50000");
    const row = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name, exact: true }) });
    await row
      .getByRole("button", { name: "현재 조건으로 갱신", exact: true })
      .click();
    await expect(row).toContainText("수정 2");
    await row.getByRole("button", { name: "삭제", exact: true }).click();
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
    savedId = undefined;
    expect(
      (
        await page.request.post("/api/saved-searches", {
          data: {
            id: randomUUID(),
            expected: 0,
            name: "invalid",
            filters: { gender: "x" },
          },
        })
      ).status(),
    ).toBe(422);
  } finally {
    if (savedId)
      sql(
        `delete from adme_search.saved_conditions where id='${savedId}'and owner_id='${accounts.brand.id}';`,
      );
  }
});
test("independent D067: fixture HTTP200 is not paid; retry keeps same order then valid duplicate confirms", async ({
  page,
}, info) => {
  const requests: unknown[] = [];
  let count = 0;
  await page.route("**/api/billing/confirm", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(
        ++count === 1 ? { ok: true } : { ok: true, duplicate: true },
      ),
    });
  });
  await page.goto(
    `/billing/success?orderId=${randomUUID()}&paymentKey=fictional-test-only&amount=4900`,
  );
  await page
    .getByRole("button", { name: "결제 결과 확인", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("같은 주문");
  expect(await page.getByRole("status").textContent()).not.toContain(
    "승인되었습니다",
  );
  await page
    .getByRole("button", { name: "결제 결과 확인", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "체험 결제가 확인되었습니다. 실제로 청구되지 않았습니다.",
  );
  expect(requests[0]).toEqual(requests[1]);
  await a11y(page);
  await page.screenshot({
    path: `output/playwright/independent-test-confirm-${info.project.name}.png`,
    fullPage: true,
  });
});
