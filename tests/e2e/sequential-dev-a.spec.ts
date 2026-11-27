import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { localAccounts, localRuntime, sql } from "../support/local-qa.mjs";
const accounts = localAccounts();
test("D048 compatibility HTTP keeps all four manual templates labeled and creates no model job or order", async ({
  page,
}) => {
  localRuntime();
  const before = sql(
    "select (select count(*)from public.orders)||':'||(select count(*)from adme_ops.jobs where kind='marketing_draft');",
  );
  for (const kind of ["concept", "proposal", "brief", "summary"]) {
    const response = await page.request.post("/api/ai/draft", {
      data: {
        kind,
        input:
          kind === "summary"
            ? { text: "가상 원문입니다. 확인 후 사용합니다." }
            : {
                product: "가상 제품",
                audience: "성인 고객",
                tone: "자연스러움",
              },
      },
    });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({
      kind,
      method: "template",
      provider: null,
      model: null,
      usage: null,
      fallback_reason: "LLM 공급자 미연결",
    });
  }
  expect(
    sql(
      "select (select count(*)from public.orders)||':'||(select count(*)from adme_ops.jobs where kind='marketing_draft');",
    ),
  ).toBe(before);
});
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("D033 filters before pages and resets cursor while preserving URL and private projection", async ({
  page,
}, info) => {
  localRuntime();
  const ids = Array.from(
    { length: 54 },
    (_, i) => "UCqa33" + String(i).padStart(18, "0"),
  );
  const list = ids.map((id) => `'${id}'`).join(",");
  try {
    sql(`insert into adme_ops.channels(channel_id,title,subscriber_count,metadata)
      select 'UCqa33'||lpad(i::text,18,'0'),'가상 D033 채널 '||lpad(i::text,2,'0'),0,
      jsonb_build_object('topics',jsonb_build_array(case when i%2=0 then 'https://en.wikipedia.org/wiki/Food'else'https://en.wikipedia.org/wiki/Technology'end),'private_canary','D033-PRIVATE')from generate_series(0,53)i;
      insert into adme_ops.featured_channel_ids(channel_id)select channel_id from adme_ops.channels where channel_id in(${list});`);
    const response = await page.goto(
      "/creators?q=" + encodeURIComponent("가상 D033"),
    );
    expect(response?.status()).toBe(200);
    expect(await response!.text()).not.toContain("D033-PRIVATE");
    const cards = page.getByTestId("youtube-channel");
    await expect(cards).toHaveCount(24);
    await expect(page.getByText("54개 채널", { exact: true })).toBeVisible();
    const firstIds = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")),
    );
    await page.getByRole("link", { name: "다음 채널", exact: true }).click();
    await expect(page).toHaveURL(/yt-cursor=/);
    await expect(cards).toHaveCount(24);
    await expect(cards.first()).not.toHaveAttribute("href", firstIds[0]!);
    const secondIds = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("href")),
    );
    expect(secondIds.some((id) => firstIds.includes(id))).toBe(false);
    expect(new URL(page.url()).searchParams.has("yt-cursor")).toBe(true);
    await page.getByLabel("YouTube 주제").selectOption("음식");
    await page.getByLabel("결과 정렬").selectOption("name");
    await page.getByRole("button", { name: "필터 적용", exact: true }).click();
    await expect(cards).toHaveCount(24);
    await expect(page.getByText("27개 채널", { exact: true })).toBeVisible();
    expect(new URL(page.url()).searchParams.has("yt-cursor")).toBe(false);
    await page.getByRole("link", { name: "다음 채널", exact: true }).click();
    await expect(cards).toHaveCount(3);
    await expect(
      page.getByRole("link", { name: "다음 채널", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "첫 페이지", exact: true }).click();
    await expect(cards).toHaveCount(24);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d033-directory-${info.project.name}.png`,
      fullPage: false,
    });
  } finally {
    sql(
      `delete from adme_ops.featured_channel_ids where channel_id in(${list});delete from adme_ops.channels where channel_id in(${list});`,
    );
  }
});
test("D044 current form applies explicit hard/soft policy and displays honest coverage", async ({
  page,
}) => {
  localRuntime();
  const owner = randomUUID(),
    secondOwner = randomUUID(),
    id = "user-" + owner,
    second = "user-" + secondOwner;
  const base = JSON.parse(
    readFileSync("fixtures/creators.demo.json", "utf8"),
  )[0];
  const profile = {
    ...base,
    name: "가상 D044 기본 후보",
    categories: ["음식"],
    platforms: ["youtube"],
    vibes: ["자연스러움"],
    is_demo: false,
    is_available: true,
    owner_consent: true,
    price_min_krw: 10000,
    price_max_krw: 20000,
    followers: 0,
    metrics_source: "unavailable",
    data_source: "owner_registration",
  };
  try {
    sql(`insert into auth.users(id,raw_user_meta_data)values('${owner}','{"role":"creator","name":"가상 D044 QA"}'),('${secondOwner}','{"role":"creator","name":"가상 D044 QA"}');
      insert into public.creators(id,owner_id,published,profile)values('${id}','${owner}',true,'${JSON.stringify(profile).replaceAll("'", "''")}'),('${second}','${secondOwner}',true,'${JSON.stringify({ ...profile, name: "가상 D044 예산 초과", price_min_krw: 20000 }).replaceAll("'", "''")}');`);
    await page.goto("/#recommendation");
    const form = page.getByRole("form", { name: "유튜버 추천 조건" });
    await form.getByLabel("상품명·설명").fill("가상 식품 QA");
    await form.getByLabel("타깃 고객").fill("성인 고객");
    await form
      .getByRole("combobox", { name: "콘텐츠 분야", exact: true })
      .selectOption("음식");
    await form.getByLabel("광고 예산 (원)").fill("10000");
    await form.getByLabel("선호 태그 (선택)").fill("자연스러움");
    await form.getByRole("button", { name: "조건에 맞는 유튜버 찾기" }).click();
    await expect(
      page
        .locator(".brief-results")
        .getByText("가상 D044 기본 후보", { exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator(".brief-results")
        .getByText("가상 D044 예산 초과", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".brief-results")).toContainText(
      "데이터 충족률 68%",
    );
    await expect(page.locator(".brief-results")).toContainText(
      "기간별 평균 조회수",
    );
    await expect(
      form.getByRole("combobox", { name: "콘텐츠 분야", exact: true }),
    ).toHaveValue("음식");
    await form
      .getByRole("combobox", { name: "예산 조건", exact: true })
      .selectOption("soft");
    await form.getByRole("button", { name: "조건에 맞는 유튜버 찾기" }).click();
    await expect(
      page
        .locator(".brief-results")
        .getByText("가상 D044 예산 초과", { exact: true }),
    ).toBeVisible();
  } finally {
    sql(
      `delete from public.creators where id in('${id}','${second}');delete from auth.users where id in('${owner}','${secondOwner}');`,
    );
  }
});
test("D075 actual private file rejects other roles, downloads only by owner and revokes after delete", async ({
  page,
  browser,
}) => {
  localRuntime();
  await login(page, "creator");
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const other = await otherContext.newPage();
  let id: string | undefined;
  try {
    await login(other, "brand");
    const bytes = await sharp({
      create: { width: 2, height: 2, channels: 4, background: "#d7ff45" },
    })
      .png()
      .toBuffer();
    const uploaded = await page.request.post("/api/uploads", {
      multipart: {
        rights: "on",
        file: {
          name: "fictional-qa.png",
          mimeType: "image/png",
          buffer: bytes,
        },
      },
    });
    expect(uploaded.status()).toBe(201);
    id = (await uploaded.json()).id;
    expect((await other.request.post(`/api/uploads/${id}`)).status()).toBe(404);
    const link = await page.request.post(`/api/uploads/${id}`);
    expect(link.status()).toBe(200);
    const signed = await link.json();
    expect(signed.expiresIn).toBeLessThanOrEqual(120);
    const downloaded = await page.request.get(signed.url);
    expect(downloaded.status()).toBe(200);
    expect(await downloaded.body()).toEqual(bytes);
    expect((await other.request.delete(`/api/uploads/${id}`)).status()).toBe(
      404,
    );
    expect((await page.request.delete(`/api/uploads/${id}`)).status()).toBe(
      200,
    );
    expect((await page.request.post(`/api/uploads/${id}`)).status()).toBe(404);
    id = undefined;
  } finally {
    if (id) await page.request.delete(`/api/uploads/${id}`);
    await otherContext.close();
  }
});
