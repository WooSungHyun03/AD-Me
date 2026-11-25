// D075/D057 desktop/mobile evidence: admin "검토 완료" in /admin report search resolves a fictional report.
// Run from ~/AD-Me-devA with ADME_LOCAL_QA=1 against the loopback replica and next dev on :3377.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sql, totp } from "./tests/support/local-qa.mjs";
const out = process.argv[2];
const base = "http://127.0.0.1:3377";
const acc = JSON.parse(readFileSync("output/dev-a-db/accounts.local.json", "utf8"));
const browser = await chromium.launch();
const report = [];
for (const [label, viewport] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const id = sql(
    `insert into public.reports(reporter_id,creator_id,kind,reason,source_url,ticket_no,due_at) values('${acc.brand.id}','creator-001','report','가상 신고 화면 검증용 사유입니다 ${label}','https://example.test/d075','ADR-D075-${label}-'||left(gen_random_uuid()::text,6),now()+interval '3 days') returning id;`,
  ).split("\n")[0];
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto(base + "/login", { timeout: 120000 });
  await page.getByLabel("이메일", { exact: true }).fill(acc.admin.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.admin.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(/dashboard/, { timeout: 120000 });
  await page.goto(base + "/admin/security");
  await page.getByLabel("6자리 OTP").fill(totp(acc.admin.totpSecret));
  await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
  await page.waitForURL(/\/admin$/, { timeout: 120000 });
  await page.getByLabel("운영 검색 대상").selectOption("reports");
  await page.getByLabel("운영 검색어").fill(id);
  await page.getByLabel("조회 사유").fill("가상 신고 처리 화면 검증");
  await page.getByRole("button", { name: "운영 검색" }).click();
  const item = page.getByTestId("admin-record").filter({ hasText: id });
  await item.waitFor({ timeout: 60000 });
  await item.getByLabel("신고 검토 사유").fill("가상 신고 검토 완료 처리");
  await item.screenshot({ path: `${out}/admin-review-before-${label}.png` });
  await item.getByRole("button", { name: "검토 완료" }).click();
  await page.waitForTimeout(1500);
  assert.equal(await item.getByRole("status").innerText().catch(() => ""), "");
  const row = sql(`select status||','||coalesce(response,'')||','||(decided_by='${acc.admin.id}') from public.reports where id='${id}';`);
  assert.equal(row, "resolved,가상 신고 검토 완료 처리,true");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `${out}/admin-review-after-${label}.png`, fullPage: true });
  sql(`delete from public.reports where id='${id}';`);
  report.push({ label, viewport, id, row, pass: true });
  await ctx.close();
}
await browser.close();
console.log(JSON.stringify(report));
