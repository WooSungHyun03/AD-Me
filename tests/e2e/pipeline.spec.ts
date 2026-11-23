// D056: dashboard stage counts equal the rows listed under that stage (also after reload), the CSV has the
// same rows, and each account only ever sees collaborations it is a party to.
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { parseCsv } from "../../src/lib/csv";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
const csvRows = async (page: Page, q = "") => {
  const r = await page.request.get(`/api/export?type=pipeline${q}`);
  expect(r.status()).toBe(200);
  return parseCsv(await r.text()).slice(1);
};

for (const who of ["brand", "creator"] as const)
  test(`pipeline counts match rows and CSV (${who})`, async ({ page }) => {
    const acc = accounts[who];
    await login(page, acc);
    const { data: mine } = await svc
      .from("proposals")
      .select("id")
      .or(`brand_id.eq.${acc.id},creator_user_id.eq.${acc.id}`);
    const truth = new Set((mine ?? []).map((x) => x.id));
    await page.goto("/dashboard");
    const stages = page.getByTestId("stages");
    await expect(stages.getByRole("link", { name: /^전체/ })).toHaveText(
      `전체 ${truth.size}`,
    );
    for (const k of ["active", "progress", "review", "completed", "closed"]) {
      await page.goto("/dashboard");
      const n = Number(
        await stages.locator(`[data-stage=${k}] strong`).innerText(),
      );
      await stages.locator(`[data-stage=${k}]`).click();
      await expect(page).toHaveURL(new RegExp(`stage=${k}`));
      await expect(page.locator("article[data-proposal-id]")).toHaveCount(n);
      await page.reload();
      await expect(page.locator("article[data-proposal-id]")).toHaveCount(n);
      const rows = await csvRows(page, `&stage=${k}`);
      expect(rows).toHaveLength(n);
    }
    const all = await csvRows(page);
    expect(new Set(all.map((r) => r[0]))).toEqual(truth); // exactly own collaborations, nobody else's
    expect(
      (await page.request.get("/api/export?type=pipeline&stage=hack")).status(),
    ).toBe(400);
  });
