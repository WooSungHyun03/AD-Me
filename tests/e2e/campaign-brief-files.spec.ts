import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  localAccounts,
  localRuntime,
  localClient,
  sql,
} from "../support/local-qa.mjs";
import { copyCampaignBrief } from "@/lib/campaign-copy";
const accounts = localAccounts();
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("D042 private immutable files survive lost client acknowledgement, restore and copy without inherited grants", async ({
  page,
  browser,
}, info) => {
  localRuntime();
  const ids: string[] = [],
    before = JSON.parse(sql("select to_jsonb(c)from adme_brief.controls c"));
  const otherContext = await browser.newContext({ ignoreHTTPSErrors: true });
  const other = await otherContext.newPage();
  const service = localClient(localRuntime().SERVICE_ROLE_KEY);
  try {
    await login(page, "brand");
    await login(other, "other");
    const source = {
      title: "가상 첨부 버전 QA",
      product: "가상 상품",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["youtube"],
      budget_krw: 100000,
      target_audience: "성인 고객",
      goal: "가상 검증 캠페인 소개",
      status: "draft",
    };
    const created = await page.request.post("/api/campaigns", { data: source });
    expect(created.status()).toBe(201);
    const id = (await created.json()).id;
    ids.push(id);
    const endpoint = `/api/campaigns/${id}/brief`;
    await page.goto(`/campaigns/${id}/brief`);
    await expect(
      page.getByRole("status").filter({ hasText: "첨부 파일 기능을 준비 중" }),
    ).toBeVisible();
    await expect(
      page.getByRole("form", { name: "캠페인 브리프 첨부" }),
    ).toHaveCount(0);
    expect((await other.request.get(endpoint)).status()).toBe(404);
    sql(
      "update adme_brief.controls set enabled=true,policy_ref='FICTIONAL browser fixture, no approval',retention_days=1;",
    );
    await page.reload();
    const form = page.getByRole("form", { name: "캠페인 브리프 첨부" });
    const bytes = await sharp({
      create: { width: 3, height: 3, channels: 4, background: "#d7ff45" },
    })
      .png()
      .toBuffer();
    await form.getByLabel("브리프 파일 (4MB 이하)").setInputFiles({
      name: "가상 첫 첨부.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await form.getByRole("checkbox").check();
    let drop = true;
    await page.route("**/api/campaigns/*/brief", async (route) => {
      if (drop && route.request().method() === "POST") {
        drop = false;
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await form.getByRole("button", { name: "새 첨부 버전 저장" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "전송 결과를 확인하지 못했습니다" }),
    ).toBeVisible();
    await form.getByRole("button", { name: "새 첨부 버전 저장" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "새 첨부 버전을 저장했습니다" }),
    ).toBeVisible();
    let data = await (await page.request.get(endpoint)).json();
    expect(data.revision).toBe(1);
    expect(data.files).toHaveLength(1);
    const first = data.activeFile;
    expect(JSON.stringify(data)).not.toContain(accounts.brand.id);
    const signed = await page.request.post(`${endpoint}/${first}`);
    expect(signed.status()).toBe(200);
    const downloaded = await page.request.get((await signed.json()).url);
    expect(await downloaded.body()).toEqual(bytes);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page
        .getByTestId("brief-file")
        .getByRole("button", { name: "파일 받기" })
        .click(),
    ]);
    expect(await download.failure()).toBeNull();
    expect(readFileSync((await download.path())!)).toEqual(bytes);
    expect((await other.request.post(`${endpoint}/${first}`)).status()).toBe(
      404,
    );
    const secondBytes = await sharp({
      create: { width: 3, height: 3, channels: 4, background: "#111312" },
    })
      .png()
      .toBuffer();
    await form.getByLabel("브리프 파일 (4MB 이하)").setInputFiles({
      name: "가상 두번째 첨부.png",
      mimeType: "image/png",
      buffer: secondBytes,
    });
    await form.getByRole("checkbox").check();
    await form.getByRole("button", { name: "새 첨부 버전 저장" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "새 첨부 버전을 저장했습니다" }),
    ).toBeVisible();
    await expect(page.getByTestId("brief-file")).toHaveCount(2);
    const stale = await page.request.post(endpoint, {
      multipart: {
        rights: "on",
        expectedVersion: "0",
        clientKey: randomUUID(),
        file: { name: "stale.png", mimeType: "image/png", buffer: bytes },
      },
    });
    expect(stale.status()).toBe(409);
    expect(
      sql(
        `select count(*)from storage.objects where bucket_id='adme-campaign-briefs'and name like '${id}/%';`,
      ),
    ).toBe("2");
    await page
      .getByTestId("brief-file")
      .filter({ hasText: "가상 첫 첨부.png" })
      .getByRole("button", { name: "이 파일로 복원" })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "이전 파일을 새 활성 버전으로 복원했습니다" }),
    ).toBeVisible();
    data = await (await page.request.get(endpoint)).json();
    expect(data.revision).toBe(3);
    expect(data.activeFile).toBe(first);
    const copied = copyCampaignBrief(
      { ownerId: accounts.brand.id, isDemo: false, brief: source },
      accounts.brand.id,
    );
    const clone = await page.request.post("/api/campaigns", { data: copied });
    expect(clone.status()).toBe(201);
    const copyId = (await clone.json()).id;
    ids.push(copyId);
    const copy = await (
      await page.request.get(`/api/campaigns/${copyId}/brief`)
    ).json();
    expect(copy.revision).toBe(0);
    expect(copy.files).toEqual([]);
    expect(
      (
        await page.request.post(`/api/campaigns/${copyId}/brief/${first}`)
      ).status(),
    ).toBe(404);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d042-brief-${info.project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "활성 첨부 해제" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "활성 첨부를 해제했습니다" }),
    ).toBeVisible();
    data = await (await page.request.get(endpoint)).json();
    expect(data.activeFile).toBeNull();
    expect(data.history).toHaveLength(4);
  } finally {
    if (ids.length) {
      const list = ids.map((id) => `'${id}'`).join(",");
      const paths = JSON.parse(
        sql(
          `select coalesce(jsonb_agg(path),'[]')from adme_brief.files where campaign_id in(${list});`,
        ),
      );
      if (paths.length)
        expect(
          (await service.storage.from("adme-campaign-briefs").remove(paths))
            .error,
        ).toBeNull();
      sql(`delete from public.campaigns where id in(${list});`);
    }
    sql(
      `update adme_brief.controls set enabled=${before.enabled},policy_ref=${before.policy_ref == null ? "null" : "'" + before.policy_ref.replaceAll("'", "''") + "'"},retention_days=${before.retention_days ?? "null"};`,
    );
    await otherContext.close();
  }
});
