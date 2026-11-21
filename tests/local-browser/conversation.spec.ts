import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localRuntime, sql } from "../support/local-qa.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
test("conversation loads one room lazily, pages history, retries lost acknowledgement once and offers private safety controls", async ({
  page,
}, info) => {
  localRuntime();
  const room = randomUUID(),
    campaign = randomUUID(),
    marker = `가상 대화 ${randomUUID().slice(0, 8)}`;
  const xss = '<img src=x onerror="window.__messageXss=1">';
  try {
    sql(`insert into public.campaigns(id,owner_id,brief) select '${campaign}','${accounts.brand.id}',brief from public.campaigns limit 1;
      insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status)
      values('${room}','${campaign}','creator-001','${accounts.brand.id}','${accounts.creator.id}','proposal','${marker}','accepted');
      insert into public.messages(proposal_id,sender_id,body,kind,created_at) select '${room}','${accounts.creator.id}','FICTIONAL history '||n,'message','2000-01-01T00:00:00.123456Z' from generate_series(1,25) n;
      insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${accounts.creator.id}','${xss}','message');`);
    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill(accounts.brand.password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    const roomPanel = page.locator("article").filter({ hasText: marker });
    const reads: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "GET" && r.url().includes("/api/messages?"))
        reads.push(r.url());
    });
    const response = await page.reload();
    expect(await response!.text()).not.toContain("FICTIONAL history");
    expect(reads).toHaveLength(0);
    await roomPanel.getByText("메시지·결과물", { exact: true }).click();
    await expect(roomPanel.getByTestId("conversation-message")).toHaveCount(20);
    expect(
      reads.every(
        (url) => new URL(url).searchParams.get("proposalId") === room,
      ),
    ).toBe(true);
    await roomPanel
      .getByRole("button", { name: "이전 메시지 더 보기" })
      .click();
    await expect(roomPanel.getByTestId("conversation-message")).toHaveCount(26);
    await expect(roomPanel.getByText(xss, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => "__messageXss" in window)).toBe(false);
    await expect(roomPanel.locator("img")).toHaveCount(0);
    const requestKeys: string[] = [];
    let lost = false;
    await page.route("**/api/messages", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      requestKeys.push(route.request().postDataJSON().clientKey);
      const response = await route.fetch();
      if (!lost) {
        lost = true;
        await route.abort("failed");
      } else await route.fulfill({ response });
    });
    const text = `FICTIONAL retry ${randomUUID().slice(0, 8)}`;
    await roomPanel.getByLabel("메시지", { exact: true }).fill(text);
    await roomPanel
      .getByRole("button", { name: "메시지 저장", exact: true })
      .click();
    const messageStatus = roomPanel
      .locator("form")
      .filter({ has: page.getByLabel("메시지", { exact: true }) })
      .getByRole("status");
    await expect(messageStatus).toContainText("같은 내용으로 다시 시도");
    await roomPanel
      .getByRole("button", { name: "메시지 저장", exact: true })
      .click();
    await expect(messageStatus).toContainText("저장되었습니다");
    expect(requestKeys).toHaveLength(2);
    expect(requestKeys[0]).toBe(requestKeys[1]);
    expect(
      sql(
        `select count(*) from public.messages where proposal_id='${room}' and body='${text}';`,
      ),
    ).toBe("1");
    await expect(roomPanel.getByText(text, { exact: true })).toHaveCount(1);
    const report = roomPanel
      .getByTestId("conversation-message")
      .filter({ hasText: xss });
    await report.getByText("메시지 신고", { exact: true }).click();
    await report
      .getByLabel("메시지 신고 사유")
      .fill("가상 메시지의 비공개 검토 요청입니다.");
    await report.getByRole("button", { name: "메시지 신고 접수" }).click();
    await expect(report.getByRole("status")).toContainText("접수되었습니다");
    await roomPanel
      .getByRole("button", { name: "대화 차단", exact: true })
      .click();
    await expect(
      roomPanel.getByText("대화가 차단되어", { exact: false }),
    ).toBeVisible();
    await expect(roomPanel.getByLabel("메시지", { exact: true })).toHaveCount(
      0,
    );
    await roomPanel
      .getByRole("button", { name: "대화 차단 해제", exact: true })
      .click();
    await expect(roomPanel.getByLabel("메시지", { exact: true })).toBeVisible();
    await report.getByText("메시지 신고", { exact: true }).click(); // Close private report before capture.
    await page.screenshot({
      path: `output/playwright/conversation-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    sql(`delete from adme_messaging.reports where message_id in (select id from public.messages where proposal_id='${room}'); delete from adme_messaging.blocks where proposal_id='${room}';
      delete from public.messages where proposal_id='${room}'; delete from public.proposals where id='${room}'; delete from public.campaigns where id='${campaign}';`);
  }
});
