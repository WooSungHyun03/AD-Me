// D070: TEST HOT appears only in a labelled ad slot; organic results are unchanged; the owner sees period + history.
import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const sql = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("HOT slot is a labelled ad, organic results unchanged, owner sees exposure history", async ({
  page,
}, info) => {
  const cid = sql(
    `select id from creators where owner_id = '${accounts.creator.id}'`,
  );
  const was = sql(`select published from creators where id = '${cid}'`);
  const note = `D070 E2E ${info.project.name} ${Date.now()}`;
  sql(`update creators set published = true where id = '${cid}'`);
  try {
    const organic = async () => {
      const r = await page.request.get("/api/creators?sort=followers");
      expect(r.ok()).toBe(true);
      return (
        (await r.json()).items as { id?: string; seed_id?: string }[]
      ).map((x) => x.id ?? x.seed_id);
    };
    const before = await organic();
    const ent = sql(
      `insert into entitlements(owner_id, sku, expires_at, credits, grant_reason, grant_note) values ('${accounts.creator.id}', 'creator_hot', now() + interval '7 days', 0, 'admin_grant', '${note}') returning id`,
    )
      .split("\n")
      .pop()!;
    expect(await organic()).toEqual(before);

    const api = await (await page.request.get("/api/promotions")).json();
    expect(api.enabled).toBe(true);
    const mine = api.slots.find(
      (s: { creator_id: string }) => s.creator_id === cid,
    );
    expect(Object.keys(mine).sort()).toEqual([
      "category",
      "creator_id",
      "expires_at",
      "name",
      "slot",
      "starts_at",
    ]);

    await page.goto("/creators");
    const slot = page.getByTestId("promotion-slot");
    await expect(slot.getByText("광고 · TEST HOT")).toBeVisible();
    await expect(slot.locator(`a[href="/creators/${cid}"]`)).toContainText(
      "광고 ~",
    );
    await expect(slot).toContainText(
      "일반 검색·추천 순위와 점수에는 영향을 주지 않습니다",
    );
    expect(
      Number(
        sql(
          `select coalesce(sum(n),0) from promotion_impressions where entitlement_id = '${ent}'`,
        ),
      ),
    ).toBeGreaterThanOrEqual(1);

    await login(page, accounts.creator);
    await expect(page.getByTestId("hot-history")).toContainText(
      /회 노출 · 광고 기간/,
    );
  } finally {
    sql(
      `update creators set published = ${was === "t"} where id = '${cid}'; delete from entitlements where grant_note = '${note}'`,
    );
  }
});
