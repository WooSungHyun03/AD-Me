import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { totp } from "../support/local-qa.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
test("approved delegated staff enroll real local Auth OTP without classic admin access", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts.staff.email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts.staff.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/admin/intelligence");
  await expect(page).toHaveURL(/admin\/security/);
  await expect(
    page.getByRole("heading", { name: "관리자 OTP 확인." }),
  ).toBeVisible();
  const pending = await page
    .getByRole("button", { name: "OTP 등록 시작" })
    .count();
  let secret = accounts.staff.totpSecret;
  if (pending) {
    const enrollment = page.waitForResponse((r) =>
      r.url().endsWith("/api/admin/mfa"),
    );
    await page.getByRole("button", { name: "OTP 등록 시작" }).click();
    const result = await enrollment;
    expect(result.status()).toBe(200);
    secret = (await result.json()).secret;
    // Mobile project reuses the same isolated account; keep its secret only in ignored QA storage.
    const { writeFileSync } = await import("node:fs");
    const stored = JSON.parse(
      readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
    );
    stored.staff.totpSecret = secret;
    writeFileSync(
      "output/dev-a-db/accounts.local.json",
      JSON.stringify(stored, null, 2),
    );
  } else {
    secret = JSON.parse(
      readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
    ).staff.totpSecret;
  }
  await page.getByLabel("6자리 OTP").fill(totp(secret));
  await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
  await expect(page).toHaveURL(/admin\/intelligence/);
  await expect(
    page.getByRole("heading", { name: "운영 콘솔", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "최근 TEST 주문" }),
  ).toHaveCount(0);
  expect(
    (
      await page.request.post("/api/admin/moderate", {
        data: {
          kind: "creator",
          id: "creator-001",
          published: false,
          reason: "Local denied attempt",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/delegated-ops-${info.project.name}.png`,
    fullPage: true,
  });
});
