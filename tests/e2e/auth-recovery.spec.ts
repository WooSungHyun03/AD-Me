import { test, expect } from "@playwright/test";

test("recovery entry points require a real email proof and preserve privacy headers", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "비밀번호를 잊으셨나요?" }).click();
  await expect(
    page.getByRole("heading", { name: "비밀번호 찾기", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("이메일", { exact: true })).toBeVisible();
  await page.goto("/reset-password");
  await expect(
    page.getByText("로그인 상태만으로 비밀번호를 재설정할 수 없습니다.", {
      exact: false,
    }),
  ).toBeVisible();
  const response = await page.goto("/auth/confirm?type=recovery");
  await expect(
    page.getByRole("heading", { name: "인증 링크를 확인해주세요" }),
  ).toBeVisible();
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response?.headers()["x-robots-tag"]).toContain("noindex");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  const callback = await page.request.get(
    "/auth/callback?next=https://evil.example/",
    { maxRedirects: 0 },
  );
  expect(callback.status()).toBe(303);
  expect(new URL(callback.headers().location, page.url()).pathname).toBe(
    "/auth/error",
  );
  expect(new URL(callback.headers().location, page.url()).hostname).not.toBe(
    "evil.example",
  );
});

test("opening confirmation does not consume proof; invalid recovery cannot change credentials", async ({
  page,
}) => {
  // Intentionally invalid fixture proof. No real email, user token or password is captured.
  const proof = "a".repeat(64);
  await page.goto(`/auth/confirm?type=email&token_hash=${proof}`);
  await expect(
    page.getByRole("button", { name: "이메일 인증 완료하기" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "이메일 인증 완료하기" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "인증 링크" }),
  ).toContainText("인증 링크가 만료되었거나 이미 사용되었습니다");
  await page.goto(`/auth/confirm?type=recovery&token_hash=${proof}`);
  await page
    .getByLabel("새 비밀번호", { exact: true })
    .fill("invalid-proof-password-123");
  await page
    .getByLabel("새 비밀번호 확인", { exact: true })
    .fill("invalid-proof-password-123");
  await page
    .getByRole("button", { name: "비밀번호 변경", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "복구 링크" }),
  ).toContainText("복구 링크가 만료되었거나 이미 사용되었습니다");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login/);
});
