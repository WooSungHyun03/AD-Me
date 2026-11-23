// D049 UI: the initiator withdraws a pending application; both sides see the final state and the event history.
import { test, expect, type Page } from "@playwright/test";
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
async function login(page: Page, who: "brand" | "creator") {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[who].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[who].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("creator cancels a pending application; history is shown to both sides", async ({
  page,
  browser,
}) => {
  await login(page, "brand");
  const unique = randomUUID().slice(0, 8);
  const made = await page.request.post("/api/campaigns", {
    data: {
      title: `QA 취소 ${unique}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 500000,
      target_audience: "20대 QA",
      goal: "취소 검증",
      status: "published",
    },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  const cc = await browser.newContext();
  const cp = await cc.newPage();
  await login(cp, "creator");
  // Own setup: other specs delete the shared creator profile.
  await cp.goto("/settings");
  await cp
    .getByLabel("크리에이터 이름", { exact: true })
    .fill(`취소검증 ${unique}`);
  await cp.getByLabel("프로필 공개", { exact: true }).check();
  await cp.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    cp.getByRole("status").filter({ hasText: "프로필을 저장했습니다" }),
  ).toBeVisible();
  await cp.goto(`/campaigns/${id}`);
  await cp
    .getByLabel("지원 메시지", { exact: true })
    .fill(`QA 취소 지원 ${unique} 메시지입니다.`);
  await cp.getByRole("button", { name: "캠페인 지원", exact: true }).click();
  await expect(cp.getByRole("status")).toContainText("전송되었습니다");
  await cp.goto("/dashboard");
  const mine = cp
    .locator("article")
    .filter({ hasText: `QA 취소 지원 ${unique}` });
  await expect(
    mine.getByRole("button", { name: "수락", exact: true }),
  ).toHaveCount(0);
  await mine.getByRole("button", { name: "요청 취소", exact: true }).click();
  await expect(mine.getByText("취소됨", { exact: true }).first()).toBeVisible();
  await expect(mine.getByTestId("proposal-event")).toHaveText([
    /응답 대기 · 나$/,
    /취소됨 · 나$/,
  ]);
  await expect(mine.getByRole("button", { name: "요청 취소" })).toHaveCount(0);
  await page.goto("/dashboard");
  const theirs = page
    .locator("article")
    .filter({ hasText: `QA 취소 지원 ${unique}` });
  await expect(theirs.getByTestId("proposal-event")).toHaveText([
    /응답 대기 · 상대$/,
    /취소됨 · 상대$/,
  ]);
  await expect(
    theirs.getByRole("button", { name: "수락", exact: true }),
  ).toHaveCount(0);
  // Server refuses a stale accept as well.
  const stale = await page.request.patch("/api/proposals", {
    data: {
      id: await theirs.getAttribute("data-proposal-id"),
      action: "accepted",
    },
  });
  expect(stale.status()).toBeGreaterThanOrEqual(400);
  await cc.close();
});
