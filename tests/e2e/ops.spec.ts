import { expect, test } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { localClient, localRuntime, sql, totp } from "../support/local-qa.mjs";
test("approved delegated staff enroll real local Auth OTP without classic admin access", async ({
  page,
}, info) => {
  // A fresh fictional staff user per run: no shared account or stored secret to expire or rewrite.
  const admin = localClient(localRuntime().SERVICE_ROLE_KEY);
  const email = `qa-staff-${randomBytes(8).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...qaSignupConsent,
      role: "brand",
      name: "QA staff fixture",
    },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    sql(
      `select adme_ops.provision_staff('${id}', 'content', 'LOCAL QA delegated fixture', now()+interval '1 hour');`,
    );
    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/admin/intelligence");
    await expect(page).toHaveURL(/admin\/security/);
    await expect(
      page.getByRole("heading", { name: "관리자 OTP 확인." }),
    ).toBeVisible();
    const enrollment = page.waitForResponse((r) =>
      r.url().endsWith("/api/admin/mfa"),
    );
    await page.getByRole("button", { name: "OTP 등록 시작" }).click();
    const result = await enrollment;
    expect(result.status()).toBe(200);
    const secret = (await result.json()).secret;
    await page.getByLabel("6자리 OTP").fill(totp(secret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(
      page.getByRole("combobox", { name: "운영 검색 대상", exact: true }),
    ).toContainText("크리에이터");
    await expect(
      page.getByRole("combobox", { name: "운영 검색 대상", exact: true }),
    ).not.toContainText("TEST 주문");
    await page
      .getByRole("link", { name: "수집·AI 운영 콘솔", exact: true })
      .click();
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
  } finally {
    sql(
      `delete from public.audit_log where entity_id='${id}'; delete from adme_ops.staff where user_id='${id}';`,
    );
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
