import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../support/local-qa.mjs";
import { createReviewBrowserCreator } from "../support/review-browser-fixtures.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
test("campaign edit preserves hard policy; saved missing evidence is held and explicit exclusion creates a new version", async ({
  page,
}, info) => {
  localRuntime();
  const actor = await createReviewBrowserCreator(),
    campaign = randomUUID();
  try {
    sql(`update public.creators set profile=profile||'{"categories":[],"is_available":true,"price_min_krw":0,"price_max_krw":10000}'::jsonb where id='${actor.creatorId}';
      insert into public.campaigns(id,owner_id,brief,status,is_demo)select '${campaign}','${accounts.brand.id}',brief||'{"title":"가상 필수 조건 QA","budget_krw":10000,"platforms":["youtube"],"policy":{"category":"hard","budget":"hard","unknown":"hold"}}'::jsonb,'draft',false from public.campaigns limit 1;
      delete from adme_ops.rate_windows where subject='${accounts.brand.id}' and scope in('recommendation_create','recommendation_context','recommendation_read');`);
    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill(accounts.brand.password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto(`/campaigns/${campaign}/edit`);
    await expect(page.locator('[name="policy_category"]')).toHaveValue("hard");
    await expect(page.locator('[name="policy_budget"]')).toHaveValue("hard");
    await expect(page.locator('[name="policy_unknown"]')).toHaveValue("hold");
    await page.getByRole("button", { name: "캠페인 저장 →" }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaign}$`));
    expect(
      JSON.parse(
        sql(
          `select brief->'policy'from public.campaigns where id='${campaign}'`,
        ),
      ),
    ).toEqual({ category: "hard", budget: "hard", unknown: "hold" });
    await page.goto(`/campaigns/${campaign}/recommendations`);
    await page
      .getByRole("button", { name: "현재 추천 저장", exact: true })
      .click();
    const record = page
      .getByTestId("saved-recommendation")
      .filter({ hasText: "가상 근거 검토 QA" });
    await expect(
      record.getByText("확인 전 보류", { exact: false }),
    ).toBeVisible();
    await expect(
      record.getByText("가상 크리에이터 · DEMO", { exact: true }),
    ).toBeVisible();
    await record.getByText("저장한 추천 근거 보기", { exact: true }).click();
    await expect(
      record.getByText("분야 미확인", { exact: false }).last(),
    ).toBeVisible();
    await page.screenshot({
      path: `output/playwright/recommendation-policy-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const first = sql(
      `select id from adme_recommendation.snapshots where campaign_id='${campaign}'`,
    );
    await page.goto(`/campaigns/${campaign}/edit`);
    await page.locator('[name="policy_unknown"]').selectOption("exclude");
    await page.getByRole("button", { name: "캠페인 저장 →" }).click();
    await expect(page).toHaveURL(new RegExp(`/campaigns/${campaign}$`));
    await page.goto(`/campaigns/${campaign}/recommendations`);
    await expect(
      page.getByText("캠페인 입력 또는 공개 프로필 데이터가 변경되었습니다.", {
        exact: false,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "현재 데이터로 재계산·새 결과 저장" })
      .click();
    await expect(record).toHaveCount(0);
    expect(
      sql(
        `select count(*)from adme_recommendation.snapshots where campaign_id='${campaign}'`,
      ),
    ).toBe("2");
    await page.goto(`/campaigns/${campaign}/recommendations?snapshot=${first}`);
    await expect(
      record.getByText("확인 전 보류", { exact: false }),
    ).toBeVisible();
  } finally {
    sql(
      `delete from public.campaigns where id='${campaign}';delete from adme_ops.rate_windows where subject='${accounts.brand.id}'and scope in('recommendation_create','recommendation_context','recommendation_read');`,
    );
    await actor.cleanup([]);
  }
});
