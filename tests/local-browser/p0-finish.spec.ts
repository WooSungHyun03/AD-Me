import { test, expect, type Page } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import sharp from "sharp";
import {
  localAccounts,
  localRuntime,
  localClient,
  sql,
} from "../support/local-qa.mjs";
import { createReviewBrowserCreator } from "../support/review-browser-fixtures.mjs";
import { cleanImageFixtures } from "../support/image-fixture-cleanup.mjs";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
const accounts = localAccounts();
async function login(page: Page, a: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(a.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(a.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("P0 home uses actual public counts and search recovers from delayed/stale requests with pagination", async ({
  page,
}, info) => {
  localRuntime();
  await page.goto("/");
  await expect(
    page.getByText("현재 공개 프로필", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("집계 시각", { exact: false })).toBeVisible();
  await page.goto("/creators");
  await expect(page.getByTestId("creator-card")).toHaveCount(24);
  await page.getByRole("button", { name: "다음 후보 더 불러오기" }).click();
  await expect(page.getByTestId("creator-card")).toHaveCount(48);
  const search = page.getByPlaceholder("이름, 계정, 분위기로 검색해보세요");
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let blocked = false;
  await page.route("**/api/creators/search?**", async (route) => {
    const q = new URL(route.request().url()).searchParams.get("q");
    if (q === "stale-p0-query") {
      blocked = true;
      await gate;
      await route.continue().catch(() => {});
    } else await route.continue();
  });
  await search.fill("stale-p0-query");
  await expect.poll(() => blocked).toBe(true);
  await search.fill("없는후보-p0-unique");
  await expect(page.getByTestId("catalog-count")).toContainText("0명");
  release();
  await expect(page.getByTestId("creator-card")).toHaveCount(0);
  await page.getByRole("button", { name: "필터 초기화" }).click();
  await expect(page.getByTestId("creator-card")).toHaveCount(24);
  await page.screenshot({
    path: `output/playwright/p0-search-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("P0 private image and logo flow uses real Auth/Storage, retries once and denies blocked or foreign download", async ({
  page,
  browser,
}, info) => {
  const runtime = localRuntime(),
    admin = localClient(runtime.SERVICE_ROLE_KEY),
    brand = {
      id: "",
      email: `p0-brand-${randomUUID()}@example.test`,
      password: randomBytes(24).toString("base64url"),
    };
  const created = await admin.auth.admin.createUser({
    email: brand.email,
    password: brand.password,
    email_confirm: true,
    user_metadata: {
      ...qaSignupConsent,
      role: "brand",
      name: "가상 P0 브랜드",
    },
  });
  expect(created.error).toBeNull();
  brand.id = created.data.user!.id;
  const actor = await createReviewBrowserCreator(),
    campaign = randomUUID(),
    room = randomUUID(),
    ctx = await browser.newContext(),
    creator = await ctx.newPage(),
    foreignContext = await browser.newContext(),
    foreign = await foreignContext.newPage();
  const png = await sharp({
    create: { width: 80, height: 40, channels: 3, background: "#d7ff45" },
  })
    .png()
    .toBuffer();
  let fileId = "";
  try {
    sql(
      `insert into public.campaigns(id,owner_id,brief) select '${campaign}','${brand.id}',brief from public.campaigns limit 1;insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${actor.creatorId}','${brand.id}','${actor.id}','proposal','가상 P0 이미지 협업 확인','accepted');`,
    );
    await login(page, brand);
    await page.goto("/settings");
    await page
      .getByLabel("브랜드명", { exact: true })
      .fill("가상 P0 로고 브랜드");
    await page.getByLabel("업종", { exact: true }).fill("가상 검증");
    await page
      .getByLabel("브랜드 소개", { exact: true })
      .fill("가상 데이터만 사용하는 로고 검증입니다.");
    await page.getByLabel("브랜드 로고 파일").setInputFiles({
      name: "fictional-logo.png",
      mimeType: "image/png",
      buffer: png,
    });
    await page.getByRole("button", { name: "로고 이미지 업로드" }).click();
    await expect(
      page.getByText("로고를 확인했습니다.", { exact: false }),
    ).toBeVisible();
    await page.getByLabel("브랜드 소개 공개", { exact: true }).check();
    await page
      .getByRole("button", { name: "브랜드 정보 저장", exact: true })
      .click();
    await expect(
      page.getByText("브랜드와 담당자 정보를 저장했습니다."),
    ).toBeVisible();
    const brandId = sql(
      `select id from public.brand_profiles where owner_id='${brand.id}';`,
    );
    const pub = await page.request.get(`/api/brands/${brandId}`);
    expect(pub.status()).toBe(200);
    expect((await pub.json()).logo.url).toBe(`/api/brands/${brandId}/logo`);
    expect(
      (await page.request.get(`/api/brands/${brandId}/logo`)).status(),
    ).toBe(200);
    await login(creator, actor);
    await creator.goto("/dashboard");
    // The room is identified by its deliverable link, independent of other rooms.
    const panel = creator.locator(".panel").filter({
      has: creator.locator(`a[href='/collaborations/${room}/deliverables']`),
    });
    await expect(panel).toHaveCount(1);
    await panel.locator("summary").filter({ hasText: "메시지·결과물" }).click();
    await panel.getByLabel("대화 이미지 파일").setInputFiles({
      name: "fictional-room.png",
      mimeType: "image/png",
      buffer: png,
    });
    let drop = true;
    await creator.route("**/api/images?**", async (route) => {
      if (drop) {
        drop = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        fileId = (await response.json()).id;
        await route.abort("connectionreset");
      } else await route.continue();
    });
    await panel
      .getByRole("button", { name: "이미지 보내기", exact: true })
      .click();
    await expect(
      panel.getByText("전송 결과를 확인하지 못했습니다.", { exact: false }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "이미지 보내기", exact: true })
      .click();
    await expect(panel.getByText("이미지 메시지를 보냈습니다.")).toBeVisible();
    expect(
      sql(
        `select count(*) from adme_upload.files where proposal_id='${room}' and message_id is not null;`,
      ),
    ).toBe("1");
    expect((await page.request.get(`/api/images/${fileId}`)).status()).toBe(
      200,
    );
    await login(foreign, accounts.other);
    expect((await foreign.request.get(`/api/images/${fileId}`)).status()).toBe(
      403,
    );
    sql(
      `insert into adme_messaging.blocks(proposal_id,actor_id) values('${room}','${brand.id}');`,
    );
    expect((await creator.request.get(`/api/images/${fileId}`)).status()).toBe(
      403,
    );
    await page.goto("/settings");
    await page.getByLabel("브랜드 소개 공개", { exact: true }).uncheck();
    await page
      .getByRole("button", { name: "브랜드 정보 저장", exact: true })
      .click();
    await expect(
      page.getByText("브랜드와 담당자 정보를 저장했습니다."),
    ).toBeVisible();
    expect(
      (await foreign.request.get(`/api/brands/${brandId}/logo`)).status(),
    ).toBe(404);
    await page.screenshot({
      path: `output/playwright/p0-brand-images-${info.project.name}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await ctx.close();
    await foreignContext.close();
    await cleanImageFixtures([brand.id, actor.id]);
    sql(
      `delete from adme_messaging.blocks where proposal_id='${room}';delete from public.audit_log where actor_id in('${brand.id}','${actor.id}');delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';delete from public.brand_contacts where owner_id='${brand.id}';delete from public.brand_profiles where owner_id='${brand.id}';delete from adme_ops.rate_windows where subject='${brand.id}';`,
    );
    await actor.cleanup([]);
    expect((await admin.auth.admin.deleteUser(brand.id)).error).toBeNull();
  }
});
