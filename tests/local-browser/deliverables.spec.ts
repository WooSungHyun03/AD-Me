import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localRuntime, sql } from "../support/local-qa.mjs";
import { createReviewBrowserCreator } from "../support/review-browser-fixtures.mjs";
import { cleanDeliveryFixtures } from "../support/delivery-fixture-cleanup.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
async function login(page: Page, c: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(c.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(c.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("versioned delivery survives lost acknowledgement, requires a new revised version and rejects stale approval in another tab", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const actor = await createReviewBrowserCreator(),
    room = randomUUID(),
    campaign = randomUUID(),
    path = `/collaborations/${room}/deliverables`;
  const creatorContext = await browser.newContext(),
    creator = await creatorContext.newPage(),
    otherContext = await browser.newContext(),
    other = await otherContext.newPage();
  try {
    sql(`insert into public.campaigns(id,owner_id,brief) select '${campaign}','${accounts.brand.id}',brief from public.campaigns limit 1;
   insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${actor.creatorId}','${accounts.brand.id}','${actor.id}','proposal','가상 결과물 version 회귀 검증입니다.','accepted');`);
    await login(creator, actor);
    await creator.goto(path);
    await expect(
      creator.getByRole("button", { name: "현재 버전 제출 완료" }),
    ).toHaveCount(0);
    await creator
      .getByLabel("결과물 설명", { exact: true })
      .fill("가상 결과물 최초 제출본입니다.");
    await creator
      .getByLabel("결과물 HTTPS 링크")
      .fill("https://example.test/fictional-version-one");
    await creator.locator('input[name="confirmed"]').check();
    const keys: string[] = [];
    let lost = false;
    await creator.route("**/api/deliverables", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      keys.push(route.request().postDataJSON().clientKey);
      const response = await route.fetch();
      if (!lost) {
        lost = true;
        await route.abort("failed");
      } else await route.fulfill({ response });
    });
    await creator.getByRole("button", { name: "새 제출본 저장" }).click();
    await expect(creator.getByRole("status")).toContainText(
      "같은 내용으로 다시 시도",
    );
    await creator.getByRole("button", { name: "새 제출본 저장" }).click();
    await expect(creator.getByTestId("active-submission")).toContainText(
      "버전 1",
    );
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    expect(
      sql(
        `select count(*) from adme_delivery.submissions where proposal_id='${room}';`,
      ),
    ).toBe("1");
    await creator.unroute("**/api/deliverables");
    await creator.getByRole("button", { name: "현재 버전 제출 완료" }).click();
    await expect(creator.getByText("검토 대기", { exact: true })).toBeVisible();
    await login(page, accounts.brand);
    await page.goto(path);
    await page
      .getByLabel("검토 의견·승인 근거")
      .fill("이전 버전에서 확인한 승인 검토 근거입니다.");
    await page
      .getByLabel("현재 제출본의 광고 표시를 확인했습니다.", { exact: true })
      .check();
    const secondTab = await page.context().newPage();
    await secondTab.goto(path);
    await secondTab
      .getByLabel("검토 의견·승인 근거")
      .fill("가상 결과물의 설명을 보완해 새 버전으로 제출해주세요.");
    await secondTab
      .getByLabel("현재 제출본의 광고 표시를 확인했습니다.", { exact: true })
      .check();
    await secondTab
      .getByRole("button", { name: "수정 요청", exact: true })
      .click();
    await expect(
      secondTab.locator(".badge").filter({ hasText: /^수정 요청$/ }),
    ).toBeVisible();
    await creator.reload();
    await expect(
      creator.getByRole("button", { name: "현재 버전 제출 완료" }),
    ).toHaveCount(0);
    await expect(
      creator.getByText("수정 요청된 제출본입니다.", { exact: false }),
    ).toBeVisible();
    await creator
      .getByLabel("결과물 설명", { exact: true })
      .fill("가상 결과물의 수정된 두 번째 제출본입니다.");
    await creator
      .getByLabel("결과물 HTTPS 링크")
      .fill("https://example.test/fictional-version-two");
    await creator.locator('input[name="confirmed"]').check();
    await creator.getByRole("button", { name: "새 제출본 저장" }).click();
    await expect(creator.getByTestId("active-submission")).toContainText(
      "버전 2",
    );
    await creator.getByRole("button", { name: "현재 버전 제출 완료" }).click();
    await expect(creator.getByText("검토 대기", { exact: true })).toBeVisible();
    const old = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/proposals") && r.request().method() === "PATCH",
    );
    await page.getByRole("button", { name: "현재 버전 검토 승인" }).click();
    expect((await old).status()).toBe(409);
    expect(sql(`select status from public.proposals where id='${room}';`)).toBe(
      "submitted",
    );
    await page.getByRole("button", { name: "최신 상태 새로고침" }).click();
    await expect(page.getByTestId("active-submission")).toContainText("버전 2");
    await expect(
      page.getByLabel("현재 제출본의 광고 표시를 확인했습니다.", {
        exact: true,
      }),
    ).not.toBeChecked();
    await expect(
      page.getByRole("button", { name: "현재 버전 검토 승인" }),
    ).toBeDisabled();
    await page
      .getByLabel("검토 의견·승인 근거")
      .fill("수정된 현재 버전의 결과물과 광고 표시를 확인했습니다.");
    await page
      .getByLabel("현재 제출본의 광고 표시를 확인했습니다.", { exact: true })
      .check();
    await page.getByRole("button", { name: "현재 버전 검토 승인" }).click();
    await expect(page.getByText("완료", { exact: true })).toBeVisible();
    await expect(page.getByTestId("submission-history")).toHaveCount(2);
    await expect(
      page.getByTestId("submission-history").filter({ hasText: "버전 1" }),
    ).toContainText("가상 결과물의 설명을 보완");
    await expect(
      page.getByTestId("submission-history").filter({ hasText: "버전 2" }),
    ).toContainText("수정된 현재 버전의 결과물");
    await creator.reload();
    await expect(
      creator.getByRole("button", { name: "새 제출본 저장" }),
    ).toHaveCount(0);
    await expect(creator.getByText("완료", { exact: true })).toBeVisible();
    await login(other, accounts.other);
    const denied = await other.request.get(
      `/api/deliverables?proposalId=${room}`,
    );
    expect(denied.status()).toBe(403);
    await other.goto(path);
    await expect(
      other.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
    ).toBeVisible();
    await page.screenshot({
      path: `output/playwright/deliverables-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await secondTab.close();
  } finally {
    await creatorContext.close();
    await otherContext.close();
    cleanDeliveryFixtures([room]);
    sql(
      `delete from public.audit_log where entity_id='${room}';delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';`,
    );
    await actor.cleanup([]);
  }
});
