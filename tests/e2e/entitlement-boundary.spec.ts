import { expect, test } from "@playwright/test";
import {
  localAccounts,
  localRuntime,
  sql,
  totp,
} from "../support/local-qa.mjs";

test("D001 isolated TEST admin can grant, database OFF rejects retries, and recovery stays available", async ({
  page,
}, info) => {
  localRuntime();
  const accounts = localAccounts();
  const prior = sql(
    "select row_to_json(b) from adme_release.billing_boundary b",
  );
  expect(sql("select enabled from adme_release.billing_boundary")).toBe("t");
  await page.goto("/pricing");
  await expect(page.getByTestId(/^pricing-/)).toHaveCount(7);
  await expect(
    page.getByText("격리된 결제 체험 화면입니다.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("d001-test-pricing.png"),
    fullPage: true,
  });
  const before = sql(
    `select count(*) from public.entitlements where owner_id='${accounts.brand.id}'`,
  );
  const note = `fictional D001 ${info.project.name} browser QA`;
  try {
    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(accounts.admin.email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill(accounts.admin.password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/admin/security");
    await page.getByLabel("6자리 OTP").fill(totp(accounts.admin.totpSecret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    const grant = {
      action: "grant",
      owner: accounts.brand.id,
      sku: "brand_pro",
      days: 30,
      credits: 3,
      note,
    };
    expect(
      (
        await page.request.post("/api/admin/entitlements", { data: grant })
      ).status(),
    ).toBe(200);
    const entitlement = sql(
      `select id from public.entitlements where owner_id='${accounts.brand.id}' and grant_note='${note}'`,
    );
    expect(entitlement).toMatch(/^[\da-f-]{36}$/);
    sql(
      "select adme_release.set_test_billing(false,'local-d001-browser-only')",
    );
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await page.request.post("/api/admin/entitlements", {
        data: grant,
      });
      expect(result.status()).toBe(404);
      expect((await result.json()).error.code).toBe("NOT_FOUND");
    }
    expect(
      Number(
        sql(
          `select count(*) from public.entitlements where owner_id='${accounts.brand.id}'`,
        ),
      ),
    ).toBe(Number(before) + 1);
    expect(
      (
        await page.request.post("/api/admin/entitlements", {
          data: { action: "revoke", id: entitlement, note },
        })
      ).status(),
    ).toBe(200);
    expect(
      sql(
        `select credits=0 and revoked_at is not null from public.entitlements where id='${entitlement}'`,
      ),
    ).toBe("t");
  } finally {
    try {
      sql(
        `delete from public.credit_ledger where entitlement_id in(select id from public.entitlements where grant_note='${note}'); delete from public.entitlements where grant_note='${note}';`,
      );
    } finally {
      sql(
        `update adme_release.billing_boundary set (enabled,release_ref,changed_at)=(select enabled,release_ref,changed_at from json_populate_record(null::adme_release.billing_boundary,'${prior.replaceAll("'", "''")}')) where singleton;`,
      );
      expect(
        sql("select row_to_json(b) from adme_release.billing_boundary b"),
      ).toBe(prior);
    }
  }
});
