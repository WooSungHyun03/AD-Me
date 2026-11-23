// D063: help page with usage/data limits; contact intake (anonymous with reply email, member answered in-app);
// admin sees defined metrics for a chosen period and answers inquiries.
import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    {
      input: q,
      encoding: "utf8",
    },
  ).trim();
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("help + contact: anonymous and member inquiries, admin answers, metrics with definitions", async ({
  page,
  browser,
}, info) => {
  const tag = `${info.project.name}-${Date.now()}`;
  try {
    // Anonymous: needs a reply email.
    await page.goto("/");
    await page.getByRole("link", { name: "도움말·문의" }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(
      page.getByRole("heading", { name: "데이터의 한계" }),
    ).toBeVisible();
    const form = page.getByRole("form", { name: "문의하기" });
    await form
      .getByLabel("문의 내용 (10~2000자)")
      .fill(`비회원 문의입니다 ${tag}`);
    await form.getByLabel("답변받을 이메일").fill(`anon-${tag}@foo.test`);
    await form.getByRole("button", { name: "문의 보내기" }).click();
    await expect(form.getByRole("status")).toHaveText(
      /입력한 이메일로 운영자가 직접 답변/,
    );

    // Member: answered inside /help.
    const ctx = await browser.newContext();
    const cp = await ctx.newPage();
    await login(cp, accounts.creator);
    await cp.goto("/help");
    const mform = cp.getByRole("form", { name: "문의하기" });
    await expect(mform.getByLabel("답변받을 이메일")).toHaveCount(0);
    await mform.getByLabel("문의 유형").selectOption("account");
    await mform
      .getByLabel("문의 내용 (10~2000자)")
      .fill(`로그인 사용자 문의 ${tag}`);
    await mform.getByRole("button", { name: "문의 보내기" }).click();
    await expect(mform.getByRole("status")).toHaveText(/내 문의/);
    const mine = cp.getByTestId("my-inquiry").filter({ hasText: tag });
    await expect(mine).toContainText("접수됨");
    // Too short → refused by the server too.
    expect(
      (
        await cp.request.post("/api/inquiries", {
          data: { category: "usage", message: "짧음" },
        })
      ).status(),
    ).toBe(400);
    // Not admin → cannot answer.
    const id = sql(
      `select id from inquiries where message = '로그인 사용자 문의 ${tag}'`,
    );
    expect(
      (
        await cp.request.post("/api/admin/inquiries", {
          data: { id, answer: "x", close: false },
        })
      ).status(),
    ).toBe(403);

    // Admin: metrics with definitions and period; answers the member.
    await login(page, accounts.admin);
    await page.goto("/admin?days=7");
    const metrics = page.getByTestId("ops-metrics");
    await expect(metrics).toContainText("기간 내 1회 이상 로그인한 계정 수");
    await expect(
      page.getByTestId("metric-period").getByRole("link", { name: "최근 7일" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(page.getByText(/제외: 테스트 계정 \d+개/)).toBeVisible();
    // Every local account is on a reserved test domain, so activity is 0 here by definition.
    await expect(metrics.locator('[data-metric="신규 가입"]')).toHaveText("0");
    const card = page
      .getByTestId("admin-inquiry")
      .filter({ hasText: `로그인 사용자 문의 ${tag}` });
    await card.getByLabel("답변").fill(`계정 설정에서 변경하세요 ${tag}`);
    await card.getByRole("button", { name: "답변 저장" }).click();
    await expect(card.getByText("답변 완료")).toBeVisible();
    await expect(
      page
        .getByTestId("admin-inquiry")
        .filter({ hasText: `비회원 문의입니다 ${tag}` }),
    ).toContainText(`anon-${tag}@foo.test`);

    await cp.reload();
    await expect(
      cp.getByTestId("my-inquiry").filter({ hasText: tag }),
    ).toContainText(`계정 설정에서 변경하세요 ${tag}`);
    await ctx.close();
  } finally {
    sql(`delete from inquiries where message like '%${tag}'`);
  }
});
