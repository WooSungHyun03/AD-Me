import { expect, test } from "@playwright/test";
import { recruitmentFixture } from "../support/local-recruitment.mjs";
import { installSession, localSession } from "../support/local-session";
import { sql } from "../support/local-qa.mjs";

test("D043 recruitment windows and capacity agree with two-role UI and preserve retries", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const f = await recruitmentFixture();
  const brandContext = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: true,
    viewport: info.project.use.viewport,
  });
  try {
    const future = await f.campaign("모집 예정", { window: f.terms(10, 20) });
    const expired = await f.campaign("모집 종료", {
      window: f.terms(-20, -10),
    });
    const open = await f.campaign("현재 모집", { capacity: 1 });
    await installSession(page, baseURL!, await localSession(f.creators[0]));
    await page.goto("/jobs/" + future.id);
    await expect(
      page.getByLabel("캠페인 조건").getByText("모집 예정", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "협업 조건", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("지원 메시지")).toHaveCount(0);
    await page.goto("/jobs/" + expired.id);
    await expect(
      page.getByLabel("캠페인 조건").getByText("마감", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("지원 메시지")).toHaveCount(0);
    await page.goto("/jobs?open=1&sort=deadline");
    await expect(
      page.getByRole("heading", { name: future.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: expired.title, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: open.title, exact: true }).first(),
    ).toBeVisible();
    await page.goto("/jobs/" + open.id);
    const pitch =
      "가상 채널에서 약속한 리뷰 영상을 제작하겠습니다. " + f.suffix;
    await page.getByLabel("지원 메시지").fill(pitch);
    await page
      .getByRole("button", { name: "지원서 제출", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "지원서를 제출했습니다", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("지원 메시지")).toHaveCount(0);
    const brand = await brandContext.newPage();
    await installSession(brand, baseURL!, await localSession(f.brand));
    await brand.goto("/dashboard");
    const article = brand.locator("article").filter({ hasText: pitch });
    await article.getByRole("button", { name: "수락", exact: true }).click();
    await expect(article.getByText("협업 진행", { exact: true })).toBeVisible();
    await installSession(page, baseURL!, await localSession(f.creators[1]));
    await page.goto("/jobs/" + open.id);
    await expect(page.getByText("선정 1 / 1명", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("캠페인 조건").getByText("마감", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("지원 메시지")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d043-full-${info.project.name}.png`,
      fullPage: true,
    });
    await brand.goto("/jobs/" + open.id);
    await brand
      .getByRole("button", { name: "캠페인 마감", exact: true })
      .click();
    await expect(
      brand.getByRole("button", { name: "캠페인 마감", exact: true }),
    ).toHaveCount(0);
    expect(
      sql(`select status from public.campaigns where id='${open.id}'`),
    ).toBe("closed");
    const retry = await f.creators[0].db.rpc("marketplace_action", {
      p_action: "apply",
      p_campaign: open.id,
      p_pitch: pitch,
    });
    expect(retry.error).toBeNull();
    expect(
      sql(
        `select count(*) from public.proposals where campaign_id='${open.id}'`,
      ),
    ).toBe("1");
    // Existing API must persist the columns actually used by the DB, not only JSON metadata.
    const created = await brand.request.post("/api/campaigns", {
      headers: { origin: baseURL! },
      data: {
        ...open.brief,
        status: "draft",
        capacity: 2,
        recruit_until: f.minute(10),
      },
    });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    expect(
      sql(
        `select capacity||','||(recruit_until is not null)::text from public.campaigns where id='${id}'`,
      ),
    ).toBe("2,true");
    expect(
      (
        await brand.request.delete("/api/campaigns?id=" + id, {
          headers: { origin: baseURL! },
        })
      ).status(),
    ).toBe(200);
  } finally {
    await page.context().clearCookies();
    await brandContext.close();
    await f.cleanup();
  }
});
