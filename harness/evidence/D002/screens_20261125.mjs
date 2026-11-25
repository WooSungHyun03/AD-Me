// D002 desktop/mobile evidence: /pricing and /about render the same catalog as the DB and freeFeatures.
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const out = process.argv[2];
const base = "http://127.0.0.1:3377";
const browser = await chromium.launch();
const report = [];
for (const [label, viewport] of [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(base + "/pricing", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  const free = await page.locator(".pricing-free li").allInnerTexts();
  assert.deepEqual(
    free.map((t) => t.trim()),
    ["YouTube 채널 탐색", "캠페인 초안과 기본 추천", "협업 제안과 진행 관리"],
  );
  const ai = await page.getByTestId("pricing-ai_credits").innerText();
  assert.match(ai, /20 크레딧 \/ 4,900원 · 30일/);
  assert.equal(await page.locator(".pricing-product").count(), 7);
  assert.ok(
    !/test_ck_|secret|Edge Function/i.test(
      await page.locator("main").innerText(),
    ),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: `${out}/pricing-${label}.png`,
    fullPage: true,
  });
  await page.goto(base + "/about", {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  const about = await page.locator("section.prose").innerText();
  assert.match(about, /AI 분석 20 크레딧 · 20 크레딧 \/ 4,900원 · 30일/);
  assert.match(about, /AI 검색권 · 1 크레딧 \/ 3,000원 · 30일/);
  assert.ok(!/Instagram|TikTok/.test(about.split("다른 SNS")[0]));
  await page.screenshot({ path: `${out}/about-${label}.png`, fullPage: true });
  report.push({ label, viewport, free, products: 7, pass: true });
  await page.close();
}
await browser.close();
console.log(JSON.stringify(report));
