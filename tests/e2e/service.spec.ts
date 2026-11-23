import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { totp } from "../support/local-qa.mjs";
import { fillCampaignTerms } from "../support/campaign-terms-form";
const accounts = JSON.parse(
  readFileSync(
    process.env.ADME_ACCOUNTS_FILE || ".accounts.local.json",
    "utf8",
  ),
) as Record<
  string,
  {
    email: string;
    password: string;
    id: string;
    factorId?: string;
    totpSecret?: string;
  }
>;
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  if (role === "admin" && accounts[role].totpSecret) {
    await page.goto("/admin/security");
    await page
      .getByLabel("6자리 OTP", { exact: true })
      .fill(totp(accounts[role].totpSecret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }
}
test("public discovery, filters, comparison, history, drafts and responsive layout", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "우리 브랜드다운",
  );
  await expect(page.locator('header img[alt="AD Me"]')).toBeVisible();
  await page.screenshot({
    path: `output/playwright/home-${info.project.name}.png`,
    fullPage: true,
  });
  await page.goto("/creators");
  await expect(page.getByTestId("creator-card")).toHaveCount(24);
  await page.getByRole("button", { name: "다음 후보 더 불러오기" }).click();
  await expect(page.getByTestId("creator-card")).toHaveCount(48);
  await page.getByLabel("크리에이터 검색").fill("서하린");
  await expect(page.getByTestId("creator-card")).toHaveCount(1);
  await page.getByLabel("크리에이터 검색").fill("결과없는이름");
  await expect(
    page.getByRole("heading", { name: "최근 공개 영상" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await page.getByTestId("filter-platform").locator("summary").click();
  await page
    .getByRole("group", { name: "플랫폼", exact: true })
    .getByLabel("YouTube", { exact: true })
    .check();
  await page.getByLabel("정렬", { exact: true }).selectOption("price");
  await page.getByLabel("후보 비교에 담기").nth(0).check();
  await page.getByLabel("후보 비교에 담기").nth(1).check();
  await page.getByRole("link", { name: "후보 비교하기" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await page.goto("/creators/creator-001");
  await expect(
    page.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
  ).toBeVisible();
  await page.goto("/tools");
  await page.getByLabel("상품·서비스").fill("비건 토너");
  await page.getByLabel("타깃 고객").fill("20대");
  await page.getByLabel("원하는 분위기").fill("자연스러움");
  await page.getByRole("button", { name: "초안 만들기" }).click();
  await expect(
    page.getByText("[규칙 기반 광고 콘셉트 초안]", { exact: false }),
  ).toBeVisible();
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "무료 베타" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/pricing-${info.project.name}.png`,
    fullPage: true,
  });
});
test("two-role real DB golden path, permissions, persistence, delivery, billing validation", async ({
  page,
  browser,
}, info) => {
  const unique = randomUUID().slice(0, 8);
  const name = `검증크리에이터 ${unique}`;
  const creator = await browser.newContext();
  const cp = await creator.newPage();
  await login(cp, "creator");
  await cp.goto("/settings");
  await cp.getByLabel("크리에이터 이름", { exact: true }).fill(name);
  await cp
    .getByLabel("소개", { exact: true })
    .fill("자연스러운 뷰티 콘텐츠를 만드는 QA 프로필");
  await cp.getByLabel("프로필 공개", { exact: true }).check();
  await cp.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    cp.getByRole("status").filter({ hasText: "프로필을 저장했습니다" }),
  ).toContainText("저장했습니다");
  await cp.reload();
  await expect(cp.getByLabel("크리에이터 이름", { exact: true })).toHaveValue(
    name,
  );
  await login(page, "brand");
  await page.goto("/campaigns/new");
  await page
    .getByLabel("캠페인 이름", { exact: true })
    .fill(`QA 비건 토너 ${unique}`);
  await page.getByLabel("상품·서비스", { exact: true }).fill("비건 토너");
  await page.getByLabel("콘텐츠 분야", { exact: true }).selectOption("뷰티");
  await page.getByLabel("타깃 고객", { exact: true }).fill("20대~30대");
  await page.getByLabel("광고 목적", { exact: true }).fill("브랜드 인지도");
  await fillCampaignTerms(page);
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page).toHaveURL(/campaigns\/[a-f0-9-]{36}/);
  const campaignId = page.url().split("/").pop()!;
  await expect(
    page.getByRole("heading", { name: "브랜드에 어울리는 발견." }),
  ).toBeVisible();
  await page.goto("/compare?ids=user-" + accounts.creator.id);
  await expect(page.getByRole("table")).toContainText(name);
  await page.goBack();
  await page
    .getByLabel("협업을 제안할 크리에이터")
    .selectOption({ label: name });
  await page
    .getByLabel("협업 제안 메시지")
    .fill("QA 검증용 비건 토너 협업을 제안합니다. 일정을 확인해주세요.");
  await page.getByRole("button", { name: "협업 제안 전송" }).click();
  await expect(page.getByRole("status")).toContainText("전송되었습니다");
  await cp.goto("/dashboard");
  const deal = cp
    .locator("article")
    .filter({ hasText: "QA 검증용 비건 토너 협업을 제안합니다." })
    .first();
  await deal.getByRole("button", { name: "수락", exact: true }).click();
  await expect(deal.getByText("협업 진행", { exact: true })).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByText("협업 진행", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("협업 진행", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/dashboard-${info.project.name}.png`,
    fullPage: true,
  });
  const anonymous = await browser.newContext();
  const ap = await anonymous.newPage();
  const denied = await ap.request.patch("/api/proposals", {
    data: { id: randomUUID(), action: "accepted" },
  });
  expect(denied.status()).toBe(401);
  await ap.goto(`/campaigns/${campaignId}`);
  await expect(
    ap.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
  ).toBeVisible();
  await anonymous.close();
  const other = await browser.newContext();
  const op = await other.newPage();
  await login(op, "other");
  const forbidden = await op.request.patch("/api/campaigns", {
    data: {
      id: campaignId,
      brief: {
        title: "타인 수정",
        product: "토너",
        category: "뷰티",
        vibes: ["청아함"],
        format: "숏폼",
        platforms: ["instagram"],
        budget_krw: 100000,
        target_audience: "20대",
        goal: "인지도",
        status: "draft",
      },
    },
  });
  expect(forbidden.status()).toBe(403);
  await op.goto("/admin");
  await expect(
    op.getByRole("heading", { name: "관리자 권한이 필요합니다." }),
  ).toBeVisible();
  await other.close();
  const order = await page.request.post("/api/billing/orders", {
    data: { sku: "brand_pro", amount: 1 },
  });
  expect(order.status()).toBe(200);
  const o = await order.json();
  expect(o.amount).toBe(49000);
  const bad = await page.request.post("/api/billing/confirm", {
    data: { orderId: o.id, paymentKey: "fake", amount: 1 },
  });
  expect(bad.status()).toBe(409);
  const fake = await page.request.post("/api/billing/confirm", {
    data: { orderId: o.id, paymentKey: "fake", amount: 49000 },
  });
  if (process.env.ADME_LOCAL_QA === "1") {
    // No payment Edge runtime/provider is started in isolated local QA.
    expect(fake.status()).toBe(503);
    expect((await fake.json()).error.code).toBe("SERVICE_UNAVAILABLE");
  } else {
    expect(fake.status()).toBe(400);
    expect((await fake.json()).error.message).toContain(
      "주문 상태를 확인해주세요",
    );
  }
  const wrongRole = await cp.request.post("/api/billing/orders", {
    data: { sku: "brand_pro" },
  });
  expect(wrongRole.status()).toBe(403);
  await deal.getByRole("link", { name: "결과물 제출·검토" }).click();
  await cp
    .getByLabel("결과물 설명", { exact: true })
    .fill("QA 결과물 초안입니다.");
  await cp
    .getByLabel("결과물 HTTPS 링크")
    .fill("https://example.com/qa-deliverable");
  await cp.locator('input[name="confirmed"]').check();
  await cp.getByRole("button", { name: "새 제출본 저장" }).click();
  await expect(cp.getByTestId("active-submission")).toContainText("버전 1");
  await cp.getByRole("button", { name: "현재 버전 제출 완료" }).click();
  await expect(cp.getByText("검토 대기", { exact: true })).toBeVisible();
  await page.reload();
  const brandDeal = page
    .locator("article")
    .filter({ hasText: "QA 검증용 비건 토너 협업을 제안합니다." })
    .first();
  await brandDeal.getByRole("link", { name: "결과물 제출·검토" }).click();
  await page
    .getByLabel("검토 의견·승인 근거")
    .fill("가상 결과물과 표시 내용을 확인한 검토 근거입니다.");
  await page
    .getByLabel("현재 제출본의 광고 표시를 확인했습니다.", { exact: true })
    .check();
  await page.getByRole("button", { name: "현재 버전 검토 승인" }).click();
  await expect(page.getByText("완료", { exact: true })).toBeVisible();
  await creator.close();
});

test("public application, shortlist persistence, account settings and administrator operations", async ({
  page,
  browser,
}) => {
  await login(page, "brand");
  const unique = randomUUID().slice(0, 8);
  const brief = {
    title: `QA 공개 모집 ${unique}`,
    product: "QA 제품",
    category: "뷰티",
    vibes: ["자연스러움"],
    format: "숏폼",
    platforms: ["instagram"],
    budget_krw: 1000000,
    target_audience: "20대 QA",
    goal: "테스트",
    status: "published",
  };
  const made = await page.request.post("/api/campaigns", { data: brief });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  await page.goto(`/campaigns/${id}/edit`);
  await page.getByLabel("광고 목적", { exact: true }).fill("수정된 QA 목표");
  await page.getByRole("button", { name: "캠페인 저장" }).click();
  await expect(page.getByText("수정된 QA 목표", { exact: true })).toBeVisible();
  const cc = await browser.newContext();
  const cp = await cc.newPage();
  await login(cp, "creator");
  const creatorName = "QA 협업 후보 " + unique;
  await cp.goto("/settings");
  await cp.getByLabel("크리에이터 이름", { exact: true }).fill(creatorName);
  await cp.getByLabel("프로필 공개", { exact: true }).check();
  await cp.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    cp.getByRole("status").filter({ hasText: "프로필을 저장했습니다" }),
  ).toBeVisible();
  await cp.goto(`/campaigns/${id}`);
  await cp
    .getByLabel("지원 메시지", { exact: true })
    .fill(`QA 지원 신청 ${unique} 테스트입니다.`);
  await cp.getByRole("button", { name: "캠페인 지원", exact: true }).click();
  await expect(cp.getByRole("status")).toContainText("전송되었습니다");
  await page.goto("/dashboard");
  const deal = page
    .locator("article")
    .filter({ hasText: `QA 지원 신청 ${unique}` });
  await deal.getByRole("button", { name: "수락", exact: true }).click();
  await expect(deal.getByText("협업 진행", { exact: true })).toBeVisible();
  await page.goto("/creators");
  const save = page.getByRole("button", {
    name: creatorName + " 즐겨찾기",
    exact: true,
  });
  if (!(await save.getAttribute("class"))?.includes("saved"))
    await save.click();
  await expect(save).toHaveClass(/saved/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: creatorName + " 즐겨찾기", exact: true }),
  ).toHaveClass(/saved/);
  const csv = await page.request.get("/api/export");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(creatorName);
  await page.goto("/settings");
  await page
    .getByLabel("계정 표시 이름", { exact: true })
    .fill("QA 브랜드 설정");
  await page.getByRole("button", { name: "계정 정보 저장" }).click();
  await expect(
    page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "계정 정보 저장" }) })
      .getByRole("status"),
  ).toContainText("저장했습니다");
  const admin = await browser.newContext();
  const ap = await admin.newPage();
  await login(ap, "admin");
  await ap.goto("/admin");
  await expect(
    ap.getByRole("heading", { name: "서비스 운영 현황." }),
  ).toBeVisible();
  await expect(
    ap.getByRole("heading", { name: "업무별 운영 검색", exact: true }),
  ).toBeVisible();
  await ap
    .getByLabel("조회 사유", { exact: true })
    .fill("가상 사용자 문의에 따른 조회");
  await ap.getByRole("button", { name: "운영 검색", exact: true }).click();
  await expect(ap.getByTestId("admin-search-results")).toBeVisible();
  await ap.screenshot({
    path: `output/playwright/admin-${test.info().project.name}.png`,
    fullPage: true,
  });
  await admin.close();
  const removed = await cp.request.delete("/api/profile");
  expect(removed.status()).toBe(200);
  await cp.goto(`/creators/user-${accounts.creator.id}`);
  await expect(
    cp.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
  ).toBeVisible();
  const disposable = await page.request.post("/api/campaigns", {
    data: { ...brief, title: `QA 삭제검증 ${unique}`, status: "draft" },
  });
  expect(disposable.status()).toBe(201);
  const removeId = (await disposable.json()).id;
  expect(
    (await page.request.delete(`/api/campaigns?id=${removeId}`)).status(),
  ).toBe(200);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
  await cc.close();
});
