// D058 UI: requester files a private correction, admin answers from the queue, requester sees only their own
// status/answer/log and appeals; another account cannot see the request.
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
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("private request → admin answer → requester status and appeal", async ({
  page,
  browser,
}) => {
  // Fresh requester: the 5-requests-per-day limit applies per account.
  const email = `adme-qa-reportui-${randomUUID().slice(0, 8)}@example.com`,
    password = randomUUID() + "Aa!";
  await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  ).auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role: "brand", name: "요청자" } },
  });
  await page.goto("/reports/new?creator=creator-010");
  await expect(page).toHaveURL(/login\?next=%2Freports|login\?next=\/reports/);
  await login(page, email, password);
  await page.goto("/creators/creator-010");
  await page.getByRole("link", { name: "자료 정정·이슈 신고" }).click();
  await page.getByLabel("요청 유형").selectOption("correction");
  await page
    .getByLabel("요청 사유")
    .fill("가상 프로필의 분야 표기가 실제 소개와 달라 정정을 요청합니다.");
  await page
    .getByLabel("확인 가능한 출처 URL")
    .fill("https://example.com/qa-correction");
  await page.getByRole("button", { name: "비공개로 요청하기" }).click();
  const ticket = (await page.getByRole("status").innerText()).match(
    /ADR-\d{6}-\d{5}/,
  )![0];
  await page.goto("/reports");
  const mine = page.getByTestId("my-report").filter({ hasText: ticket });
  await expect(mine.getByText("접수", { exact: true })).toBeVisible();
  await expect(mine).toContainText("정보 정정");
  await expect(mine).toContainText("처리 기한");

  const ac = await browser.newContext();
  const ap = await ac.newPage();
  await login(ap, accounts.admin.email, accounts.admin.password);
  await ap.goto("/admin");
  const item = ap.getByTestId("admin-report").filter({ hasText: ticket });
  await expect(item).toContainText("정보 정정");
  await item.getByRole("button", { name: "처리 완료" }).click();
  await expect(item.getByRole("alert")).toContainText("답변");
  await item
    .getByLabel("요청자에게 보낼 답변")
    .fill("확인 후 분야 표기를 정정했습니다.");
  await item.getByRole("button", { name: "처리 완료" }).click();
  await expect(item.getByText("처리 완료", { exact: true })).toBeVisible();
  await expect(item.getByRole("button", { name: "처리 완료" })).toHaveCount(0);

  await page.reload();
  await expect(
    mine.getByText("처리 완료", { exact: true }).first(),
  ).toBeVisible();
  await expect(mine).toContainText("확인 후 분야 표기를 정정했습니다.");
  await expect(mine.locator("li")).toHaveCount(2);
  await mine.getByRole("link", { name: "재심 요청" }).click();
  await page
    .getByLabel("재심 사유")
    .fill("정정 범위가 일부 누락되어 재심을 요청합니다.");
  await page.getByRole("button", { name: "비공개로 요청하기" }).click();
  await expect(page.getByRole("status")).toContainText("접수번호");
  await page.goto("/reports");
  await expect(
    page.getByTestId("my-report").filter({ hasText: "재심 요청" }),
  ).toHaveCount(1);
  await expect(mine.getByRole("link", { name: "재심 요청" })).toHaveCount(0);

  // Another account sees none of it.
  const bc = await browser.newContext();
  const bp = await bc.newPage();
  await login(bp, accounts.brand.email, accounts.brand.password);
  await bp.goto("/reports");
  await expect(bp.getByText(ticket)).toHaveCount(0);
  await Promise.all([ac.close(), bc.close()]);
});
