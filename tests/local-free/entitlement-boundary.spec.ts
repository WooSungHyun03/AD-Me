import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { localRuntime, sql } from "../support/local-qa.mjs";

test("D001 free pricing and signed-in roles cannot issue TEST grants or expose existing TEST credits", async ({
  page,
}, info) => {
  localRuntime();
  const accounts = JSON.parse(
    readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
  );
  expect(sql("select enabled from adme_release.billing_boundary")).toBe("f");
  await page.goto("/pricing");
  await expect(
    page.getByRole("heading", { name: "무료 베타", exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId(/^pricing-/)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "검색·게시·지원 이용권", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("d001-free-pricing.png"),
    fullPage: true,
  });

  for (const role of ["brand", "creator", "admin"]) {
    await page.context().clearCookies();
    const account = accounts[role],
      entitlement = randomUUID();
    // A historical TEST row is retained in this same fictional account across the mode boundary.
    sql(
      `insert into public.entitlements(id,owner_id,sku,expires_at,credits,grant_reason,grant_note)values('${entitlement}','${account.id}','${role === "creator" ? "creator_hot" : "brand_pro"}',now()+interval'1 day',937,'admin_grant','fictional D001 historical QA');`,
    );
    const before = sql(
      `select count(*) from public.entitlements where owner_id='${account.id}'`,
    );
    try {
      await page.goto("/login");
      await page.getByLabel("이메일", { exact: true }).fill(account.email);
      await page.getByLabel("비밀번호", { exact: true }).fill(account.password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(
        page.getByRole("heading", { name: "이용권·결제 내역" }),
      ).toHaveCount(0);
      await expect(
        page.getByText("잔여 크레딧 937", { exact: false }),
      ).toHaveCount(0);
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await page.request.post("/api/admin/entitlements", {
          data: {
            action: "grant",
            owner: accounts.brand.id,
            sku: "brand_pro",
            days: 30,
            credits: 3,
            note: "fictional D001 retry QA",
          },
        });
        expect(response.status()).toBe(404);
        expect((await response.json()).error).toMatchObject({
          code: "NOT_FOUND",
          requestId: response.headers()["x-request-id"],
        });
      }
      expect(
        sql(
          `select count(*) from public.entitlements where owner_id='${account.id}'`,
        ),
      ).toBe(before);
      if (role !== "admin") {
        await page.goto("/admin");
        await expect(
          page.getByRole("heading", { name: "관리자 권한이 필요합니다." }),
        ).toBeVisible();
      }
    } finally {
      sql(`delete from public.entitlements where id='${entitlement}';`);
    }
  }
});
