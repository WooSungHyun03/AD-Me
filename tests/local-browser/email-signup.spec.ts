import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { localClient, localRuntime } from "../support/local-qa.mjs";
// Same override as tests/ci-db.sh; the default is the primary local stack.
const mailpit = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

async function messages(request: APIRequestContext, email: string) {
  const response = await request.get(`${mailpit}/api/v1/messages?limit=100`);
  expect(response.ok()).toBe(true);
  const result = await response.json();
  return (result.messages ?? []).filter(
    (message: { To: { Address: string }[] }) =>
      message.To.some((to) => to.Address === email),
  );
}
test("local Auth signup, real inbox sink resend, GET non-consumption and proof reuse denial", async ({
  page,
  browser,
}) => {
  const email = `local-signup-${randomBytes(8).toString("hex")}@example.test`;
  const password = randomBytes(24).toString("base64url");
  const runtime = localRuntime();
  const admin = localClient(runtime.SERVICE_ROLE_KEY);
  let userId: string | undefined;
  try {
    await page.goto("/signup");
    await page.getByLabel("이름", { exact: true }).fill("QA 가입 검증");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(password);
    await page.getByLabel("이용약관에 동의합니다", { exact: false }).check();
    await page
      .getByLabel("개인정보 처리 안내를 확인했습니다", { exact: false })
      .check();
    await page
      .getByLabel("만 19세 이상 성인임을 확인합니다", { exact: false })
      .check();
    await page
      .getByRole("button", { name: "계정 만들기", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "이 주소에서 이메일 인증이 필요하면",
    );
    await expect
      .poll(async () => (await messages(page.request, email)).length)
      .toBe(1);
    const users = await admin.auth.admin.listUsers();
    userId = users.data.users.find((user) => user.email === email)?.id;
    expect(Boolean(userId)).toBe(true);
    expect(
      (await admin.auth.admin.getUserById(userId!)).data.user
        ?.email_confirmed_at,
    ).toBeFalsy();
    const loginAttempt = await localClient().auth.signInWithPassword({
      email,
      password,
    });
    expect(loginAttempt.error?.code).toBe("email_not_confirmed");

    // The isolated Mailpit project uses a one-second resend interval; no external SMTP is contacted.
    await expect
      .poll(() => Date.now(), { intervals: [250] })
      .toBeGreaterThan(Date.now() + 1100);
    await page.goto("/signup/resend");
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page
      .getByRole("button", { name: "확인 메일 재발송", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "이 주소에서 이메일 인증이 필요하면",
    );
    await expect
      .poll(async () => (await messages(page.request, email)).length)
      .toBe(2);
    const inbox = await messages(page.request, email);
    const mail = await page.request.get(
      `${mailpit}/api/v1/message/${inbox[0].ID}`,
    );
    const html = (await mail.json()).HTML as string;
    const proofUrl = /href="([^"]+token_hash=[^"]+)"/
      .exec(html)?.[1]
      ?.replaceAll("&amp;", "&");
    if (!proofUrl || new URL(proofUrl).origin !== "https://127.0.0.1:3143")
      throw new Error("Local confirmation template origin mismatch");
    await page.goto(proofUrl);
    await page.reload();
    expect(
      (await admin.auth.admin.getUserById(userId!)).data.user
        ?.email_confirmed_at,
    ).toBeFalsy();
    await page
      .getByRole("button", { name: "이메일 인증 완료하기", exact: true })
      .click();
    await expect(page).toHaveURL(/dashboard/);
    expect(
      Boolean(
        (await admin.auth.admin.getUserById(userId!)).data.user
          ?.email_confirmed_at,
      ),
    ).toBe(true);
    const replay = await browser.newContext();
    const replayPage = await replay.newPage();
    await replayPage.goto(proofUrl);
    await replayPage
      .getByRole("button", { name: "이메일 인증 완료하기", exact: true })
      .click();
    await expect(
      replayPage.getByRole("alert").filter({ hasText: "인증 링크" }),
    ).toContainText("이미 사용되었습니다");
    await replay.close();
  } finally {
    if (userId)
      expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull();
  }
});
