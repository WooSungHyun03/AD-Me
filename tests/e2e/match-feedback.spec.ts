import { verifyAdminOtp } from "./support/admin";
// D046: the campaign owner rates shown recommendations with a reason; the server decides rank/version;
// others cannot rate; the admin view refuses to claim performance on sparse data.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("matching feedback: owner rates with reason, others blocked, admin sees honest summary", async ({
  page,
  browser,
}) => {
  await login(page, accounts.brand);
  const made = await page.request.post("/api/campaigns", {
    data: {
      title: `피드백 캠페인 ${Date.now()}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 1000000,
      target_audience: "20대",
      goal: "추천 평가 검증",
      status: "draft",
    },
  });
  const { id } = await made.json();
  await page.goto(`/campaigns/${id}`);
  const form = page.getByRole("form", { name: /추천 평가$/ }).first();
  await form.getByLabel("적합 여부").selectOption("unfit");
  await form.getByLabel("사유").selectOption("budget_mismatch");
  await form.getByRole("button", { name: "평가 저장" }).click();
  await expect(form.getByText("평가를 저장했습니다.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("form", { name: /추천 평가$/ }).first(),
  ).toContainText("평가됨: 예산이 맞지 않음");

  // Not in the shown list / bad reason → refused.
  const post = (p: Page, d: object) =>
    p.request.post("/api/matching-feedback", {
      data: { campaignId: id, ...d },
    });
  expect(
    (
      await post(page, {
        creatorId: "no-such-creator",
        verdict: "fit",
        reason: "vibe_match",
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await post(page, {
        creatorId: "creator-001",
        verdict: "fit",
        reason: "brand_safety",
      })
    ).status(),
  ).toBe(400);

  // Another account: no rating controls, API refused.
  const other = await (await browser.newContext()).newPage();
  await login(other, accounts.creator);
  await other.goto(`/campaigns/${id}`).catch(() => null);
  await expect(other.getByRole("form", { name: /추천 평가$/ })).toHaveCount(0);
  expect(
    (
      await post(other, {
        creatorId: "creator-001",
        verdict: "fit",
        reason: "vibe_match",
      })
    ).status(),
  ).toBe(403);

  const admin = await (await browser.newContext()).newPage();
  await login(admin, accounts.admin);
  await verifyAdminOtp(admin, accounts.admin.totpSecret);
  await admin.goto("/admin");
  await expect(admin.getByTestId("feedback-eval")).toContainText(
    "성능 주장 불가",
  );
});
