// D052 UI: live unread badge across two tabs, inbox, read cursor survives re-login.
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
const LIVE = { timeout: 10_000 }; // below the 30s poll interval, so passing proves realtime delivered it

test("unread badge updates live in two tabs; read cursor persists after re-login", async ({
  page,
  browser,
}, info) => {
  const shot = async (p: typeof page, name: string) => {
    if (process.env.ADME_EVIDENCE_DIR)
      await p.screenshot({
        path: `${process.env.ADME_EVIDENCE_DIR}/${name}-${info.project.name}.png`,
        fullPage: true,
      });
  };
  await login(page, "brand");
  const unique = randomUUID().slice(0, 8);
  const made = await page.request.post("/api/campaigns", {
    data: {
      title: `QA 알림 ${unique}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 500000,
      target_audience: "20대 QA",
      goal: "알림 검증",
      status: "published",
    },
  });
  expect(made.status()).toBe(201);
  const { id } = await made.json();
  // Start from zero: clear older notifications.
  expect((await page.request.post("/api/read", { data: {} })).ok()).toBe(true);
  const inbox = await page.context().newPage();
  await inbox.goto("/notifications");
  await page.goto("/dashboard");
  const badgeA = page.getByTestId("unread-count");
  const badgeB = inbox.getByTestId("unread-count");
  await expect(badgeA).toHaveText("새 알림 없음");
  await expect(badgeB).toHaveText("새 알림 없음");

  const cc = await browser.newContext();
  const cp = await cc.newPage();
  await login(cp, "creator");
  await cp.goto("/settings");
  await cp
    .getByLabel("크리에이터 이름", { exact: true })
    .fill(`알림검증 ${unique}`);
  await cp.getByLabel("프로필 공개", { exact: true }).check();
  await cp.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    cp.getByRole("status").filter({ hasText: "프로필을 저장했습니다" }),
  ).toBeVisible();
  // Clear the shared creator account's older notifications so "sender not notified" is measurable.
  expect((await cp.request.post("/api/read", { data: {} })).ok()).toBe(true);
  await cp.goto(`/campaigns/${id}`);
  await cp
    .getByLabel("지원 메시지", { exact: true })
    .fill(`QA 알림 지원 ${unique} 메시지입니다.`);
  await cp.getByRole("button", { name: "캠페인 지원", exact: true }).click();
  await expect(cp.getByRole("status")).toContainText("전송되었습니다");

  // Both brand tabs update without reload.
  await expect(badgeA).toHaveText("1개 안 읽음", LIVE);
  await expect(badgeB).toHaveText("1개 안 읽음", LIVE);
  // The creator (sender) is not notified of their own application.
  await cp.goto("/dashboard");
  await expect(cp.getByTestId("unread-count")).toHaveText("새 알림 없음");

  await inbox.reload();
  const first = inbox.getByTestId("notification").first();
  await expect(first).toHaveAttribute("data-unread", "true");
  await expect(first).toContainText("새 제안·지원이 도착했습니다");
  await page.reload();
  await expect(
    page
      .locator("article")
      .filter({ hasText: `QA 알림 지원 ${unique}` })
      .getByText("새 알림 1"),
  ).toBeVisible();
  await shot(page, "dashboard");
  await shot(inbox, "inbox");
  await inbox.getByRole("button", { name: "모두 읽음으로 표시" }).click();
  await expect(badgeB).toHaveText("새 알림 없음");
  await expect(inbox.getByTestId("notification").first()).toHaveAttribute(
    "data-unread",
    "false",
  );
  await expect(badgeA).toHaveText("새 알림 없음", LIVE); // other tab follows the cursor

  await page.getByRole("button", { name: "로그아웃" }).click();
  await login(page, "brand");
  await expect(page.getByTestId("unread-count")).toHaveText("새 알림 없음");
  // A stale tab/retry sending an older cursor never resurrects read notifications.
  expect(
    (await page.request.post("/api/read", { data: { upto: 1 } })).ok(),
  ).toBe(true);
  await page.reload();
  await expect(page.getByTestId("unread-count")).toHaveText("새 알림 없음");
  // Unknown fields are rejected rather than silently treated as "read all".
  expect(
    (await page.request.post("/api/read", { data: { upto: "all" } })).status(),
  ).toBe(422);
  await cc.close();
});

test("polling fallback updates the badge when realtime is blocked", async ({
  page,
  browser,
}) => {
  test.slow();
  // Block the realtime websocket entirely; only the 30s polling path remains.
  await page.routeWebSocket(/\/realtime\//, (ws) => ws.close());
  await login(page, "brand");
  const unique = randomUUID().slice(0, 8);
  const { id } = await (
    await page.request.post("/api/campaigns", {
      data: {
        title: `QA 폴링 ${unique}`,
        product: "QA",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["instagram"],
        budget_krw: 500000,
        target_audience: "20대 QA",
        goal: "폴링 검증",
        status: "published",
      },
    })
  ).json();
  await page.request.post("/api/read", { data: {} });
  await page.goto("/dashboard");
  await expect(page.getByTestId("unread-count")).toHaveText("새 알림 없음");
  const cc = await browser.newContext();
  const cp = await cc.newPage();
  await login(cp, "creator");
  await cp.goto("/settings");
  await cp
    .getByLabel("크리에이터 이름", { exact: true })
    .fill(`폴링검증 ${unique}`);
  await cp.getByLabel("프로필 공개", { exact: true }).check();
  await cp.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(
    cp.getByRole("status").filter({ hasText: "프로필을 저장했습니다" }),
  ).toBeVisible();
  const pr = await cp.request.post("/api/proposals", {
    data: {
      kind: "application",
      campaignId: id,
      creatorId: `user-${accounts.creator.id}`,
      brief: `QA 폴링 지원 ${unique} 메시지입니다.`,
    },
  });
  expect(pr.ok()).toBe(true);
  await expect(page.getByTestId("unread-count")).toHaveText("1개 안 읽음", {
    timeout: 45_000,
  });
  await cc.close();
});

test("notification API requires login and stays private", async ({
  request,
}) => {
  expect((await request.get("/api/notifications")).status()).toBe(401);
  expect((await request.post("/api/read", { data: {} })).status()).toBe(401);
});
