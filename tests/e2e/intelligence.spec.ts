import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { verifyAdminOtp } from "./support/admin";
import { finishLocalFixtureJob } from "../support/local-fixture-worker.mjs";
import { finishLocalWorkerJob, isolatedYoutube } from "./support/youtube";
const localFixture = process.env.ADME_LOCAL_QA === "1";

const accounts = JSON.parse(
  readFileSync(
    process.env.ADME_ACCOUNTS_FILE ?? ".accounts.local.json",
    "utf8",
  ),
) as Record<string, { email: string; password: string; totpSecret?: string }>;

async function login(page: Page, account: "admin" | "brand" | "creator") {
  await page.goto("/login");
  await page
    .getByLabel("이메일", { exact: true })
    .fill(accounts[account].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[account].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("operations console checks sessions and permissions on desktop and mobile", async ({
  page,
}, info) => {
  await page.goto("/admin/intelligence");
  await expect(page).toHaveURL(/login/);
  await login(page, "brand");
  await page.goto("/admin/intelligence");
  await expect(
    page.getByRole("heading", { name: "관리자 권한이 필요합니다." }),
  ).toBeVisible();
  const denied = await page.request.post("/api/admin/intelligence", {
    data: { action: "discovery", value: "QA fixture", extra: "false" },
  });
  expect(denied.status()).toBe(403);
  const isolated = await page.context().browser()!.newContext(info.project.use);
  try {
    const admin = await isolated.newPage();
    await login(admin, "admin");
    await verifyAdminOtp(admin, accounts.admin.totpSecret!);
    await admin.goto("/admin/intelligence");
    await expect(
      admin.getByRole("heading", { name: "운영 콘솔", exact: true }),
    ).toBeVisible();
    await expect(
      admin.getByRole("heading", { name: "YouTube 수집", exact: true }),
    ).toBeVisible();
    expect(
      await admin.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await admin.screenshot({
      path: `output/playwright/operations-${info.project.name}.png`,
      fullPage: true,
    });
  } finally {
    await isolated.close();
  }
});

test(
  localFixture || isolatedYoutube
    ? "brand draft completes through isolated fixture lease/finish RPCs (no provider)"
    : "brand submits a private Korean draft to the real worker",
  async ({ page }) => {
    await login(page, "brand");
    const queued = await page.request.post("/api/intelligence", {
      data: {
        brief:
          "무향 선크림을 소개하는 YouTube 영상. 효능을 단정하지 말고 손에 바르는 장면을 포함해주세요.",
      },
    });
    expect(queued.status()).toBe(202);
    const { id } = await queued.json();
    if (localFixture) await finishLocalFixtureJob("marketing_draft");
    else if (isolatedYoutube) finishLocalWorkerJob("marketing_draft");
    await expect
      .poll(
        async () => {
          const response = await page.request.get("/api/intelligence?id=" + id);
          return response.ok()
            ? (await response.json()).status
            : response.status();
        },
        { timeout: 75000, intervals: [500, 1000, 2000, 3000] },
      )
      .toBe("done");
    const response = await page.request.get("/api/intelligence?id=" + id);
    expect(JSON.stringify((await response.json()).output)).toMatch(/[가-힣]/);
  },
);

test("unverified YouTube candidates remain private and creators can unlink a claim", async ({
  page,
}) => {
  await page.goto("/creators/youtube");
  await expect(
    page.getByRole("heading", { name: "확인된 YouTube 채널" }),
  ).toBeVisible();
  await page
    .getByRole("searchbox", { name: "채널 이름" })
    .fill("Google for Developers");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(
    page.getByText("공개된 채널 중 검색 조건과 일치하는 채널이 없습니다."),
  ).toBeVisible();
  await login(page, "creator");
  await page.goto("/settings/youtube");
  await page
    .getByLabel("YouTube 채널 ID 또는 주소")
    .fill("UC_x5XG1OV2P6uZZ5FSM9Ttw");
  await page.getByRole("button", { name: "채널 추가", exact: true }).click();
  await expect(page.locator("code")).toHaveText(/^ADME-[a-f0-9]{32}$/);
  await expect(
    page.getByRole("button", { name: "채널 검색 공개에 동의", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "소유권 확인 요청", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "확인 작업을 등록했습니다" }),
  ).toBeVisible();
  if (localFixture) await finishLocalFixtureJob("youtube_claim");
  else if (isolatedYoutube) finishLocalWorkerJob("youtube_claim");
  await expect
    .poll(
      async () => {
        await page.reload();
        return page
          .getByText("채널 설명에서 인증 문자열을 확인하지 못했습니다.", {
            exact: true,
          })
          .count();
      },
      { timeout: 45000, intervals: [1000, 2000, 3000] },
    )
    .toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "채널 연결 해제", exact: true })
    .click();
  await expect(page.locator("code")).toHaveCount(0);
});
