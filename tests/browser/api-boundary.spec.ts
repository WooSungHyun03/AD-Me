import { test, expect } from "@playwright/test";

test("public health and ordinary denied API responses expose no diagnostics or provider values", async ({
  page,
}) => {
  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(503);
  expect(await health.json()).toEqual({ status: "down" });
  expect(health.headers()["x-request-id"]).toMatch(/^[a-f0-9-]{36}$/);
  const denied = await page.request.post("/api/campaigns", { data: {} });
  expect(denied.status()).toBe(503);
  const result = await denied.json();
  expect(result.error).toMatchObject({
    code: "SERVICE_UNAVAILABLE",
    requestId: denied.headers()["x-request-id"],
  });
  expect(JSON.stringify(result)).not.toMatch(
    /SELECT |stack|sb_secret|eyJ|SERVICE_ROLE_KEY/,
  );
  const res = await page.request.post(
    "/api/uploads/00000000-0000-4000-8000-000000000001",
  );
  expect(res.status()).toBe(401);
  expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
});

test("real HTTP oversized bodies receive a safe correlated 413 even with a forged media type", async ({
  page,
}) => {
  const payload = JSON.stringify({
    value: "PRIVATE_BODY_CANARY" + "x".repeat(1024 * 1024),
  });
  for (const type of [
    "application/json",
    "text/plain",
    "multipart/form-data; boundary=forged",
  ]) {
    const response = await page.request.post("/api/claims", {
      data: payload,
      headers: { "Content-Type": type, "X-Request-Id": "caller-controlled" },
    });
    expect(response.status()).toBe(413);
    const result = await response.json();
    expect(result.error).toMatchObject({
      code: "PAYLOAD_TOO_LARGE",
      requestId: response.headers()["x-request-id"],
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_BODY_CANARY");
    expect(response.headers()["x-request-id"]).not.toBe("caller-controlled");
  }
});

test("login remains usable and reports unavailable account configuration safely", async ({
  page,
}, info) => {
  await page.goto("/login");
  await page
    .getByLabel("이메일", { exact: true })
    .fill("fictional-qa@example.test");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("fictional-password-only");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  const error = page
    .getByRole("alert")
    .filter({ hasText: "계정 서비스 연결 준비 중" });
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/playwright/api-boundary-login-${info.project.name}.png`,
    fullPage: false,
  });
});
