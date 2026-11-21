import { expect, test, type Page } from "@playwright/test";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { readFileSync } from "node:fs";
import { totp, localRuntime, localClient, sql } from "../support/local-qa.mjs";
import { randomBytes, randomUUID } from "node:crypto";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
async function login(page: Page, role: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("brand CRUD preserves contact privacy and denies another account", async ({
  page,
  browser,
}, info) => {
  await login(page, "brand");
  await page.goto("/settings");
  await page.getByLabel("브랜드명", { exact: true }).fill("QA 가상 브랜드");
  await page.getByLabel("업종", { exact: true }).fill("교육");
  await page
    .getByLabel("브랜드 소개", { exact: true })
    .fill("실제 기업이 아닌 격리 로컬 검증용 자료입니다.");
  await page.getByLabel("브랜드 소개 공개", { exact: true }).check();
  await page.getByLabel("담당자 이름", { exact: true }).fill("QA 담당자");
  await page
    .getByLabel("담당자 업무 이메일", { exact: true })
    .fill("qa-private@example.test");
  await page
    .getByLabel("담당자 공개 범위", { exact: true })
    .selectOption("private");
  const saved = page.waitForResponse(
    (res) =>
      res.url().endsWith("/api/account") && res.request().method() === "PATCH",
  );
  await page
    .getByRole("button", { name: "브랜드 정보 저장", exact: true })
    .click();
  const response = await saved;
  expect(response.status()).toBe(200);
  const { brandId } = await response.json();
  await expect(
    page.getByRole("status").filter({ hasText: "브랜드와 담당자" }),
  ).toContainText("저장했습니다");
  await page.reload();
  await expect(page.getByLabel("브랜드명", { exact: true })).toHaveValue(
    "QA 가상 브랜드",
  );
  const publicResult = await page.request.get(`/api/brands/${brandId}`);
  expect(publicResult.status()).toBe(200);
  expect(await publicResult.json()).toEqual({
    version: 1,
    id: brandId,
    brandName: "QA 가상 브랜드",
    industry: "교육",
    introduction: "실제 기업이 아닌 격리 로컬 검증용 자료입니다.",
    logo: null,
  });
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await login(otherPage, "other");
  expect(
    (await otherPage.request.get(`/api/brands/${brandId}/contact`)).status(),
  ).toBe(404);
  const forged = await otherPage.request.patch("/api/account", {
    data: { name: "QA", owner_id: accounts.brand.id },
  });
  expect(forged.status()).toBe(422);
  await other.close();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/brand-settings-${info.project.name}.png`,
    fullPage: true,
  });
});

test("administrator MFA and audited moderation survive owner republish", async ({
  page,
  browser,
}, info) => {
  await login(page, "admin");
  const denied = await page.request.post("/api/admin/moderate", {
    data: {
      kind: "creator",
      id: "creator-001",
      published: false,
      reason: "QA denial fixture",
    },
  });
  expect(denied.status()).toBe(403);
  await page.goto("/admin");
  await expect(page).toHaveURL(/admin\/security/);
  await expect(
    page.getByRole("heading", { name: "관리자 OTP 확인." }),
  ).toBeVisible();
  await page.screenshot({
    path: `output/playwright/admin-mfa-${info.project.name}.png`,
    fullPage: true,
  });
  await page
    .getByLabel("6자리 OTP", { exact: true })
    .fill(totp(accounts.admin.totpSecret));
  await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const owner = await browser.newContext();
  const cp = await owner.newPage();
  await login(cp, "creator");
  const profile = {
    name: `QA 운영잠금 ${info.project.name}`,
    bio: "가상 로컬 검증용 프로필",
    categories: ["뷰티"],
    vibes: ["자연스러움"],
    formats: ["숏폼"],
    platforms: ["instagram"],
    price_min_krw: 0,
    price_max_krw: 0,
    is_available: true,
    published: true,
  };
  expect(
    (
      await cp.request.post("/api/profile", {
        data: {
          profile,
          publication: {
            version: qaSignupConsent.policy_version,
            documentHash: qaSignupConsent.policy_hash,
            requestKey: randomUUID(),
          },
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page
    .getByRole("combobox", { name: "운영 검색 대상", exact: true })
    .selectOption("creators");
  await page.getByLabel("운영 검색어", { exact: true }).fill(profile.name);
  await page
    .getByLabel("조회 사유", { exact: true })
    .fill("QA 격리 환경 운영 잠금 확인");
  await page.getByRole("button", { name: "운영 검색", exact: true }).click();
  const row = page
    .getByTestId("admin-record")
    .filter({ hasText: profile.name });
  await row.getByLabel("운영 조치 사유").fill("QA 격리 환경 운영 잠금 확인");
  await row.getByRole("button", { name: "운영 비공개 잠금" }).click();
  await expect(
    row.getByRole("button", { name: "운영 잠금 해제" }),
  ).toBeVisible();
  expect(
    (
      await cp.request.post("/api/profile", {
        data: {
          profile,
          publication: {
            version: qaSignupConsent.policy_version,
            documentHash: qaSignupConsent.policy_hash,
            requestKey: randomUUID(),
          },
        },
      })
    ).status(),
  ).toBe(200);
  const id = `user-${accounts.creator.id}`;
  await cp.goto(`/creators/${id}`);
  await expect(
    cp.getByRole("heading", { name: "찾으시는 페이지가 없습니다." }),
  ).toBeVisible();
  await row.getByLabel("운영 조치 사유").fill("QA 격리 환경 운영 잠금 해제");
  await row.getByRole("button", { name: "운영 잠금 해제" }).click();
  await expect(
    row.getByRole("button", { name: "운영 비공개 잠금" }),
  ).toBeVisible();
  await cp.reload();
  await expect(
    cp.getByRole("heading", { name: profile.name, exact: true }),
  ).toBeVisible();
  expect((await cp.request.delete("/api/profile")).status()).toBe(200);
  await owner.close();
});

test("new provisioned administrator completes actual local TOTP enrollment", async ({
  page,
}) => {
  const admin = localClient(localRuntime().SERVICE_ROLE_KEY);
  const email = `qa-enrollment-${randomBytes(8).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      ...qaSignupConsent,
      role: "brand",
      name: "QA enrollment fixture",
    },
  });
  expect(created.error).toBeNull();
  const id = created.data.user!.id;
  try {
    sql(
      `select public.provision_administrator('${id}', 'LOCAL enrollment fixture approval', now()+interval '1 hour');`,
    );
    accounts.adminEnrollment = { email, password, id };
    await login(page, "adminEnrollment");
    await page.goto("/admin/security");
    const enroll = page.getByRole("button", {
      name: "OTP 등록 시작",
      exact: true,
    });
    await expect(enroll).toBeVisible();
    const response = page.waitForResponse(
      (result) =>
        result.url().endsWith("/api/admin/mfa") &&
        result.request().method() === "POST",
    );
    await enroll.click();
    const result = await response;
    expect(result.status()).toBe(200);
    expect(result.headers()["cache-control"]).toContain("no-store");
    const secret = await page.locator("code").textContent();
    if (!secret)
      throw new Error("Local TOTP enrollment did not return a secret");
    // Keep the fixture secret only in memory; no screenshots, traces or public evidence.
    await page.getByLabel("6자리 OTP", { exact: true }).fill(totp(secret));
    await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
  } finally {
    sql(
      `delete from public.audit_log where entity_id='${id}'; delete from public.administrator_grants where user_id='${id}';`,
    );
    expect((await admin.auth.admin.deleteUser(id)).error).toBeNull();
  }
});
