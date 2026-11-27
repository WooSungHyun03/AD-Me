import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import {
  dropCreatorProfile,
  localAccounts,
  ensureCreatorProfile,
  localRuntime,
  sql,
} from "../support/local-qa.mjs";

const accounts = () =>
  localAccounts() as Record<
    "brand" | "creator",
    { id: string; email: string; password: string }
  >;

async function login(page: Page, role: "brand" | "creator") {
  const { email, password } = accounts()[role];
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("YouTube campaign defaults and an unverified application conflict are visible", async ({
  page,
  browser,
}) => {
  localRuntime();
  const own = ensureCreatorProfile(accounts().creator.id);
  // Earlier specs may leave this shared account verified; the conflict below needs it unclaimed.
  const claim = sql(
    `select claim_status from public.creators where id='${own.id}';`,
  );
  sql(
    `update public.creators set claim_status='unclaimed' where id='${own.id}';`,
  );
  await login(page, "brand");
  await page.goto("/campaigns/new");
  await expect(page.getByRole("checkbox", { name: "youtube" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "instagram" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("checkbox", { name: "tiktok" })).toHaveCount(0);

  const name = "QA YouTube 캠페인 " + randomUUID().slice(0, 8);
  const response = await page.request.post("/api/campaigns", {
    data: {
      title: name,
      product: "QA 제품",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "제품 리뷰",
      platforms: ["youtube"],
      budget_krw: 1000000,
      target_audience: "성인 시청자",
      goal: "제품 리뷰 검증",
      status: "published",
    },
  });
  expect(response.status()).toBe(201);
  const { id } = await response.json();

  const creator = await browser.newContext();
  try {
    const applicant = await creator.newPage();
    await login(applicant, "creator");
    const pitch = name + " 지원합니다.";
    await applicant.goto("/campaigns/" + id);
    await applicant.getByLabel("지원 메시지", { exact: true }).fill(pitch);
    await applicant
      .getByRole("button", { name: "캠페인 지원", exact: true })
      .click();
    await expect(applicant.getByRole("status")).toContainText("전송되었습니다");

    await page.goto("/dashboard");
    const deal = page.locator("article").filter({ hasText: pitch });
    const denied = page.waitForResponse(
      (res) =>
        res.url().endsWith("/api/proposals") &&
        res.request().method() === "PATCH",
    );
    await deal.getByRole("button", { name: "수락", exact: true }).click();
    expect((await denied).status()).toBe(409);
    await expect(deal.getByRole("alert")).toContainText("본인 확인이 해제되어");
  } finally {
    await creator.close();
    sql(
      `update public.creators set claim_status='${claim}' where id='${own.id}';`,
    );
    dropCreatorProfile(own);
  }
});
