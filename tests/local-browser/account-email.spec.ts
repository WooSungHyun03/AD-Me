import { randomUUID } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { expect, test, type Page } from "@playwright/test";
import { localRuntime, localClient, sql } from "../support/local-qa.mjs";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { localProof } from "../support/local-auth-mail";
async function login(page: Page, email: string, password: string) {
  await page.goto("/login?next=/settings");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/settings$/);
}
async function create(role: string) {
  const admin = localClient(localRuntime().SERVICE_ROLE_KEY),
    email = `d010-${randomUUID()}@example.test`,
    password = randomUUID() + "Aa1!";
  const result = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role, name: "D010 local QA" },
  });
  expect(result.error).toBeNull();
  return { admin, email, password, id: result.data.user!.id };
}
test("D010 both roles change email only after current-session reauthentication and both mailbox proofs", async ({
  page,
  browser,
  baseURL,
}, info) => {
  for (const role of ["brand", "creator"]) {
    await page.context().clearCookies();
    const a = await create(role),
      next = `d010-new-${randomUUID()}@example.test`;
    try {
      if (role === "brand") {
        // Age only this disposable session's AMR, then obtain a fresh real Auth token.
        const cookies: { name: string; value: string }[] = [];
        const first = createServerClient(
          localRuntime().API_URL,
          localRuntime().ANON_KEY,
          {
            cookies: {
              getAll: () => cookies,
              setAll: (values) => {
                for (const value of values) {
                  const index = cookies.findIndex((c) => c.name === value.name);
                  if (index >= 0) cookies[index] = value;
                  else cookies.push(value);
                }
              },
            },
          },
        );
        expect((await first.auth.signInWithPassword(a)).error).toBeNull();
        const claims = (await first.auth.getClaims()).data!.claims;
        sql(
          `update auth.mfa_amr_claims set created_at=now()-interval'20 minutes',updated_at=now()-interval'20 minutes' where session_id='${claims.session_id}';`,
        );
        expect(
          (await localClient().auth.signInWithPassword(a)).error,
        ).toBeNull();
        expect((await first.auth.refreshSession()).error).toBeNull();
        await page.context().addCookies(
          cookies.map((c) => ({
            name: c.name,
            value: c.value,
            url: baseURL!,
            sameSite: "Lax" as const,
          })),
        );
        await page.goto("/settings");
        await page.getByLabel("새 이메일", { exact: true }).fill(next);
        await page
          .getByRole("button", { name: "이메일 변경 요청", exact: true })
          .click();
        await expect(
          page.getByRole("alert").filter({ hasText: "다시 로그인" }),
        ).toBeVisible();
        expect(
          (await a.admin.auth.admin.getUserById(a.id)).data.user?.email,
        ).toBe(a.email);
      }
      await login(page, a.email, a.password);
      await page.getByLabel("새 이메일", { exact: true }).fill(next);
      await page
        .getByRole("button", { name: "이메일 변경 요청", exact: true })
        .click();
      await expect(
        page.getByRole("status").filter({ hasText: "확인 메일을 보냈습니다" }),
      ).toBeVisible();
      if (role === "brand")
        await page.screenshot({
          path: `output/playwright/d010-email-${info.project.name}.png`,
          fullPage: true,
          mask: [
            page.getByText(a.email, { exact: false }),
            page.getByLabel("새 이메일", { exact: true }),
          ],
        });
      const oldProof = await localProof(page.request, a.email, "email_change"),
        newProof = await localProof(page.request, next, "email_change");
      await page.goto(oldProof);
      await page.reload();
      expect(
        (await a.admin.auth.admin.getUserById(a.id)).data.user?.email,
      ).toBe(a.email);
      await page
        .getByRole("button", { name: "이메일 인증 완료하기", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("다른 주소");
      expect(
        (await a.admin.auth.admin.getUserById(a.id)).data.user?.email,
      ).toBe(a.email);
      await page.goto(newProof);
      await page
        .getByRole("button", { name: "이메일 인증 완료하기", exact: true })
        .click();
      await expect(page).toHaveURL(/\/settings$/);
      expect(
        (await a.admin.auth.admin.getUserById(a.id)).data.user?.email,
      ).toBe(next);
      expect(
        (
          await localClient().auth.signInWithPassword({
            email: a.email,
            password: a.password,
          })
        ).error,
      ).not.toBeNull();
      expect(
        (
          await localClient().auth.signInWithPassword({
            email: next,
            password: a.password,
          })
        ).error,
      ).toBeNull();
      const replay = await browser.newContext({ ignoreHTTPSErrors: true });
      try {
        const tab = await replay.newPage();
        await tab.goto(newProof);
        await tab
          .getByRole("button", { name: "이메일 인증 완료하기", exact: true })
          .click();
        await expect(
          tab.getByRole("alert").filter({ hasText: "인증 링크" }),
        ).toContainText("이미 사용");
      } finally {
        await replay.close();
      }
      expect(sql(`select role from public.profiles where id='${a.id}'`)).toBe(
        role,
      );
    } finally {
      expect((await a.admin.auth.admin.deleteUser(a.id)).error).toBeNull();
    }
  }
});
test("D010 recovery rejects expired/reused proof, updates its owner across another role's session and revokes refresh sessions", async ({
  page,
}) => {
  const a = await create("brand"),
    other = await create("creator"),
    newPassword = randomUUID() + "Bb2!",
    oldSession = localClient();
  try {
    expect((await oldSession.auth.signInWithPassword(a)).error).toBeNull();
    await login(page, other.email, other.password);
    const request = async () => {
      await page.goto("/forgot-password");
      await page.getByLabel("이메일", { exact: true }).fill(a.email);
      await page
        .getByRole("button", { name: "복구 메일 요청", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("계정이 있다면");
    };
    const reset = async (url: string) => {
      await page.goto(url);
      await page.getByLabel("새 비밀번호", { exact: true }).fill(newPassword);
      await page
        .getByLabel("새 비밀번호 확인", { exact: true })
        .fill(newPassword);
      await page
        .getByRole("button", { name: "비밀번호 변경", exact: true })
        .click();
    };
    await request();
    const expired = await localProof(page.request, a.email, "recovery");
    sql(
      `update auth.users set recovery_sent_at=now()-interval'2 hours' where id='${a.id}'`,
    );
    await reset(expired);
    await expect(
      page.getByRole("alert").filter({ hasText: "복구 링크" }),
    ).toContainText("만료되었거나 이미 사용");
    expect((await localClient().auth.signInWithPassword(a)).error).toBeNull();
    await request();
    const valid = await localProof(page.request, a.email, "recovery", 1);
    await page.goto(valid);
    await page.reload();
    await reset(valid);
    await expect(page).toHaveURL(/\/login\?password_reset=complete$/);
    expect(
      (await localClient().auth.signInWithPassword(a)).error,
    ).not.toBeNull();
    expect(
      (
        await localClient().auth.signInWithPassword({
          email: a.email,
          password: newPassword,
        })
      ).error,
    ).toBeNull();
    expect(
      (await localClient().auth.signInWithPassword(other)).error,
    ).toBeNull();
    expect((await oldSession.auth.refreshSession()).error).not.toBeNull();
    await reset(valid);
    await expect(
      page.getByRole("alert").filter({ hasText: "복구 링크" }),
    ).toContainText("만료되었거나 이미 사용");
  } finally {
    await a.admin.auth.admin.deleteUser(a.id);
    await other.admin.auth.admin.deleteUser(other.id);
  }
});
