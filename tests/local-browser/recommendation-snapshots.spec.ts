import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { localRuntime, sql } from "../support/local-qa.mjs";
import { createReviewBrowserCreator } from "../support/review-browser-fixtures.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
async function login(page: Page, account: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(account.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("saved recommendations preserve lost-ack retries, source changes, explicit recalculation and private history", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const actor = await createReviewBrowserCreator(),
    campaign = randomUUID(),
    path = `/campaigns/${campaign}/recommendations`,
    otherContext = await browser.newContext(),
    other = await otherContext.newPage();
  try {
    sql(
      `update public.creators set profile=profile||'{"vibes":["snapshot-browser"],"is_available":true,"price_min_krw":0,"price_max_krw":1000000}'::jsonb where id='${actor.creatorId}';`,
    );
    // Build a valid fictional brief from the exact profile; avoid arbitrary real data.
    sql(
      `insert into public.campaigns(id,owner_id,brief,status,is_demo) select '${campaign}','${accounts.brand.id}',ca.brief||jsonb_build_object('title','가상 추천 저장 QA','vibes',jsonb_build_array('snapshot-browser'),'category',cr.profile->'categories'->>0,'format',cr.profile->'formats'->>0,'platforms',cr.profile->'platforms','budget_krw',10000),'published',true from public.campaigns ca cross join public.creators cr where cr.id='${actor.creatorId}' limit 1;`,
    );
    await login(page, accounts.brand);
    await page.goto(`/campaigns/${campaign}`);
    await page
      .getByRole("link", { name: "추천 저장·이전 결과 확인 ↗" })
      .click();
    await expect(
      page.getByText("아직 저장한 추천이 없습니다.", { exact: false }),
    ).toBeVisible();
    let drop = true;
    await page.route("**/api/recommendations", async (route) => {
      if (route.request().method() === "POST" && drop) {
        drop = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await page
      .getByRole("button", { name: "현재 추천 저장", exact: true })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "전송 결과를 확인하지 못했습니다" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "현재 추천 저장", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "현재 데이터로 재계산·새 결과 저장" }),
    ).toBeVisible();
    expect(
      sql(
        `select count(*) from adme_recommendation.snapshots where campaign_id='${campaign}';`,
      ),
    ).toBe("1");
    const first = sql(
        `select id from adme_recommendation.snapshots where campaign_id='${campaign}';`,
      ),
      record = page
        .getByTestId("saved-recommendation")
        .filter({ hasText: "가상 근거 검토 QA" });
    await expect(record.locator(".score")).toHaveText("100점");
    await record.getByText("저장한 추천 근거 보기", { exact: true }).click();
    await expect(
      record.getByText("오디언스 데이터 미확보", { exact: false }),
    ).toBeVisible();
    await page.reload();
    await expect(record.locator(".score")).toHaveText("100점");
    sql(
      `update public.creators set profile=jsonb_set(profile,'{price_min_krw}','1000000') where id='${actor.creatorId}';`,
    );
    await page.reload();
    await expect(
      page.getByText("캠페인 입력 또는 공개 프로필 데이터가 변경되었습니다.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(record.locator(".score")).toHaveText("100점");
    await page
      .getByRole("button", { name: "현재 데이터로 재계산·새 결과 저장" })
      .click();
    await expect(record.locator(".score")).not.toHaveText("100점");
    expect(
      sql(
        `select count(*) from adme_recommendation.snapshots where campaign_id='${campaign}';`,
      ),
    ).toBe("2");
    await page.locator(`a[href='${path}?snapshot=${first}']`).click();
    await expect(page).toHaveURL(new RegExp(`snapshot=${first}`));
    await expect(record.locator(".score")).toHaveText("100점");
    await expect(
      page.getByText("선택한 과거 결과입니다.", { exact: false }),
    ).toBeVisible();
    sql(
      `update public.creators set published=false where id='${actor.creatorId}';`,
    );
    await page.reload();
    await expect(record).toHaveCount(0);
    await expect(
      page.getByText("현재 공개 범위를 벗어난 후보 1명", { exact: false }),
    ).toBeVisible();
    await login(other, accounts.other);
    expect(
      (
        await other.request.get(
          `/api/recommendations?campaignId=${campaign}&snapshotId=${first}`,
        )
      ).status(),
    ).toBe(403);
    await other.goto(path);
    await expect(
      other.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
    ).toBeVisible();
    await page.screenshot({
      path: `output/playwright/recommendations-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await otherContext.close();
    // Actual owner's existing campaign delete semantics must clean only this history.
    sql(`delete from public.campaigns where id='${campaign}';`);
    await actor.cleanup([]);
  }
});
