import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

test.skip(
  process.env.ADME_FREE_CAMPAIGN_QA !== "1",
  "Requires a disposable DB, free mode, and a verified synthetic YouTube creator",
);

async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("free YouTube campaign from draft to private two-role conversation", async ({
  page: brand,
  browser,
  baseURL,
}, testInfo) => {
  expect(new URL(baseURL!).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const { brand: brandAccount, creator: creatorAccount, other } = JSON.parse(
    readFileSync(process.env.ADME_ACCOUNTS_FILE ?? ".accounts.local.json", "utf8"),
  );
  const creatorContext = await browser.newContext({
    baseURL,
    viewport: testInfo.project.use.viewport,
  });
  const thirdPartyContext = await browser.newContext({ baseURL });
  try {
    const creator = await creatorContext.newPage();
    const thirdParty = await thirdPartyContext.newPage();
    const slug = randomUUID().slice(0, 8);
    const product = `QA 협업 상품 ${slug}`;
    const title = `QA 협업 캠페인 ${slug}`;
    const application = `공식 채널에서 캠페인 ${slug} 제품을 리뷰하겠습니다.`;

    await login(brand, brandAccount);
    await brand.goto("/brand/products");
    await brand.getByLabel("상품 이름").fill(product);
    await brand.getByLabel("상품 설명").fill("격리 브라우저에서 제품 협업을 검증합니다.");
    await brand.getByRole("button", { name: "상품 등록", exact: true }).click();
    await expect(brand.getByText("상품을 등록했습니다.")).toBeVisible();
    await brand.getByRole("link", { name: "캠페인 초안 만들기" }).click();
    await brand.getByLabel("광고 상품").selectOption({ label: product });
    await brand.getByLabel("캠페인 제목").fill(title);
    await brand.getByLabel("총 예산 (원)").fill("100000");
    await brand.getByLabel("광고 목표와 요청 결과물").fill("제품을 소개하는 리뷰 영상");
    await brand.getByLabel("대상 시청자").fill("20대 성인");
    await brand.getByLabel("콘텐츠 분위기 (쉼표로 구분)").fill("자연스러움");
    await brand.getByRole("button", { name: "무료로 초안 저장" }).click();
    await expect(brand).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/);
    const campaignPath = new URL(brand.url()).pathname;

    await thirdParty.goto(campaignPath);
    await expect(thirdParty.getByRole("heading", { name: "찾으시는 페이지가 없습니다." })).toBeVisible();
    await brand.getByRole("button", { name: "캠페인 공개", exact: true }).click();
    await expect(brand.getByRole("heading", { name: "캠페인을 공개했습니다" })).toBeVisible();
    await expect(brand.getByRole("heading", { name: "지원자 검토" })).toBeVisible();

    await login(creator, creatorAccount);
    await creator.goto(campaignPath);
    await creator.getByLabel("지원 메시지").fill(application);
    await creator.getByRole("button", { name: "지원서 제출" }).click();
    await expect(creator.getByRole("heading", { name: "지원서를 제출했습니다" })).toBeVisible();
    await expect(creator.getByRole("link", { name: "제출한 지원서 상태 보기" })).toBeVisible();
    await creator.reload();
    await expect(creator.getByRole("button", { name: "지원서 제출" })).toHaveCount(0);

    await brand.goto("/dashboard");
    const proposal = brand.locator("article").filter({ hasText: application });
    await expect(proposal).toHaveCount(1);
    await proposal.getByRole("button", { name: "수락", exact: true }).click();
    await expect(proposal.getByText("협업 진행", { exact: true })).toBeVisible();
    const messagesPath = await proposal.getByRole("link", { name: "메시지 열기" }).getAttribute("href");
    expect(messagesPath).toMatch(/^\/collaborations\/[\da-f-]+\/messages$/);
    await brand.goto(messagesPath!);
    await creator.goto(messagesPath!);
    await expect(creator.getByRole("heading", { name: title }).first()).toBeVisible();
    const message = `캠페인 일정과 검토 일자를 확인해주세요. ${slug}`;
    await brand.getByLabel("메시지", { exact: true }).fill(message);
    await brand.getByRole("button", { name: "메시지 저장" }).click();
    await expect(brand.getByText(message, { exact: true })).toBeVisible();
    await expect(creator.getByText(message, { exact: true })).toBeVisible({ timeout: 16000 });
    await creator.reload();
    await expect(creator.getByText(message, { exact: true })).toBeVisible();

    await login(thirdParty, other);
    await thirdParty.goto(messagesPath!);
    await expect(thirdParty.getByRole("heading", { name: "찾으시는 페이지가 없습니다." })).toBeVisible();
    await expect(thirdParty.getByText(message, { exact: true })).toHaveCount(0);
  } finally {
    await Promise.all([creatorContext.close(), thirdPartyContext.close()]);
  }
});
