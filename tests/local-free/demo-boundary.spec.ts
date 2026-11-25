import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("D005 free DB shows registered data while hiding DEMO detail, legacy APIs, counts and campaign fallback", async ({
  page,
}, info) => {
  localRuntime();
  expect(sql("select demo_enabled from adme_release.catalog_boundary")).toBe(
    "f",
  );
  const owner = randomUUID(),
    id = `d005-browser-${randomUUID()}`,
    title = "D005 로컬 등록 프로필 QA";
  try {
    sql(
      // Own fictional owner: the shared creator account may already hold a profile row (owner_id is unique).
      `insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"가상 D005 QA"}');
      insert into public.creators(id,owner_id,published,profile)select '${id}','${owner}',true,profile||'{"name":"${title}","is_demo":false,"followers":0,"metrics_source":"unavailable"}'::jsonb from public.creators where id='creator-001';`,
    );
    const ref = sql(`select adme_creator.public_reference('${id}')`);
    await page.goto("/creators");
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("가상 프로필 · DEMO", { exact: true }),
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d005-free-directory-${info.project.name}.png`,
      fullPage: true,
    });
    for (const path of [
      "/api/creators/search",
      "/api/creators?p_include_demo=true",
    ]) {
      const response = await page.request.get(path);
      expect(response.status()).toBe(200);
      const data = await response.json();
      expect(
        data.items.some(
          (c: { seed_id: string }) => c.seed_id === ref || c.seed_id === id,
        ),
      ).toBe(true);
      expect(data.items.every((c: { is_demo: boolean }) => !c.is_demo)).toBe(
        true,
      );
    }
    expect(
      (await page.request.get("/api/creators/search?p_demo=true")).status(),
    ).toBe(422);
    expect(
      (
        await page.request.get("/api/compare?ids=creator-001,creator-002")
      ).status(),
    ).toBe(404);
    for (const path of ["/creators/creator-001", "/campaigns/campaign-001"]) {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
      ).toBeVisible();
    }
    await page.goto(`/creators/${ref}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("본인 등록 · 외부 검증 전", { exact: true }),
    ).toBeVisible();
    await page.goto("/campaigns");
    await expect(
      page.getByText("가상 캠페인 · DEMO", { exact: true }),
    ).toHaveCount(0);
    const sitemap = await page.request.get("/sitemap.xml");
    expect(sitemap.status()).toBe(200);
    expect(await sitemap.text()).not.toContain("creator-001");
  } finally {
    sql(
      `delete from public.creators where id='${id}';delete from auth.users where id='${owner}';`,
    );
  }
});
