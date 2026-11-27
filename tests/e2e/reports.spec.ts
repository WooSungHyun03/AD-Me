import { verifyAdminOtp } from "./support/admin";
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
  await expect(page.getByRole("status")).toContainText("접수번호");
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
  await verifyAdminOtp(ap, accounts.admin.totpSecret);
  // D058 requests are handled from the D060 operations search (reports scope), found by ticket number;
  // each row shows the ticket, request kind and deadline (20261127110000).
  const reportId = (await mine.getAttribute("data-report-id"))!;
  await ap.goto("/admin");
  await ap.getByLabel("운영 검색 대상").selectOption("reports");
  await ap.getByLabel("운영 검색어").fill(ticket);
  await ap.getByLabel("조회 사유").fill("D058 정정 요청 처리 검증");
  await ap.getByRole("button", { name: "운영 검색" }).click();
  const item = ap.getByTestId("admin-record").filter({ hasText: reportId });
  await expect(item).toContainText("pending");
  await expect(item.getByRole("heading")).toHaveText(`${ticket} · 정보 정정`);
  await expect(item.getByTestId("admin-report-deadline")).toContainText(
    "처리 기한",
  );
  await item
    .getByLabel("신고 검토 사유")
    .fill("확인 후 분야 표기를 정정했습니다.");
  await item.getByRole("button", { name: "검토 완료" }).click();
  await expect(item).toContainText("resolved");

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
