// D072: the fee simulator is labelled as an assumption, validates bounds, and sends nothing to the server.
import { test, expect } from "@playwright/test";
test("fee simulator is assumption-only and local", async ({ page }) => {
  await page.goto("/pricing");
  const sim = page.getByTestId("fee-simulator");
  await expect(sim).toContainText("가정 계산 · 실제 수납·정산 없음");
  await expect(sim).toContainText(
    "저장·집계되지 않고 실제 청구·미수금·매출이 아닙니다",
  );
  const calls: string[] = [];
  page.on("request", (r) => r.url().includes("/api/") && calls.push(r.url()));
  await sim.getByLabel("협업 금액 (원)").fill("2500000");
  await sim.getByLabel("가정 수수료율 (%)").fill("12");
  await expect(sim.getByRole("status")).toContainText(
    "가정 수수료 300,000원 · 크리에이터 수령 가정액 2,200,000원",
  );
  await sim.getByLabel("가정 수수료율 (%)").fill("31");
  await expect(sim.getByRole("status")).toContainText("0~30%");
  await sim.getByLabel("협업 금액 (원)").fill("-5");
  await expect(sim.getByRole("status")).toContainText("정수로 입력하세요");
  expect(calls).toEqual([]);
});
