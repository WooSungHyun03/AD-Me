import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { localClient, localRuntime, sql, totp } from "../support/local-qa.mjs";
import { qaSignupConsent } from "../support/consent-fixture.mjs";
// Intake ships disabled behind operator review; open it only in this disposable local DB and restore after.
let intake = "";
test.beforeAll(() => {
  localRuntime();
  intake = sql(
    "select enabled::text||'|'||coalesce(review_ref,'') from adme_privacy.intake;",
  );
  sql(
    "update adme_privacy.intake set enabled=true,review_ref=coalesce(review_ref,'FICTIONAL LOCAL E2E QUARANTINE; no erasure approval');",
  );
});
test.afterAll(() => {
  const [enabled, ref] = intake.split("|");
  sql(
    `update adme_privacy.intake set enabled=${enabled === "true"},review_ref=${ref ? `'${ref.replace(/'/g, "''")}'` : "null"};`,
  );
});
for (const role of ["brand", "creator"] as const)
  test(`${role} deletion request reauthenticates, survives lost receipt and waits honestly for retention`, async ({
    page,
  }, info) => {
    const runtime = localRuntime(),
      admin = localClient(runtime.SERVICE_ROLE_KEY),
      email = `erase-browser-${randomUUID()}@example.test`,
      password = randomBytes(24).toString("base64url");
    const made = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { ...qaSignupConsent, role, name: "가상 삭제 요청" },
    });
    expect(made.error).toBeNull();
    const actor = made.data.user!.id;
    let secret: string | undefined;
    try {
      if (role === "creator") {
        const c = localClient();
        expect(
          (await c.auth.signInWithPassword({ email, password })).error,
        ).toBeNull();
        const enrolled = await c.auth.mfa.enroll({ factorType: "totp" });
        expect(enrolled.error).toBeNull();
        secret = enrolled.data!.totp.secret;
        expect(
          (
            await c.auth.mfa.challengeAndVerify({
              factorId: enrolled.data!.id,
              code: totp(secret),
            })
          ).error,
        ).toBeNull();
        await c.auth.signOut({ scope: "local" });
      }
      await page.goto("/login");
      await page.getByLabel("이메일", { exact: true }).fill(email);
      await page.getByLabel("비밀번호", { exact: true }).fill(password);
      await page.getByRole("button", { name: "로그인", exact: true }).click();
      await expect(page).toHaveURL(/dashboard/);
      await page.goto("/settings");
      const panel = page.locator(".panel").filter({
        has: page.getByRole("heading", {
          name: "계정 삭제 요청",
          exact: true,
        }),
      });
      await panel
        .getByLabel("현재 비밀번호", { exact: true })
        .fill(secret ? password : "invalid-password-fixture");
      await panel
        .getByLabel("확인 문구: 계정 삭제 요청", { exact: true })
        .fill("계정 삭제 요청");
      await panel.getByRole("checkbox").check();
      await panel
        .getByRole("button", { name: "재인증 후 삭제 요청 접수", exact: true })
        .click();
      await expect(panel.getByRole("alert")).toContainText("현재 비밀번호");
      expect(
        sql(
          `select count(*)from adme_privacy.requests where actor_id='${actor}';`,
        ),
      ).toBe("0");
      await panel.getByLabel("현재 비밀번호", { exact: true }).fill(password);
      if (secret)
        await panel
          .getByLabel("인증 앱 코드 (등록한 경우)", { exact: true })
          .fill(totp(secret));
      let payload: Record<string, unknown> | undefined,
        dropped = false;
      await page.route("**/api/account/deletion", async (route) => {
        payload = route.request().postDataJSON();
        if (!dropped) {
          dropped = true;
          const r = await route.fetch();
          expect(r.status()).toBe(202);
          await route.abort("connectionreset");
          return;
        }
        await route.continue();
      });
      await panel
        .getByRole("button", { name: "재인증 후 삭제 요청 접수", exact: true })
        .click();
      await expect(panel.getByRole("status")).toContainText("삭제 요청이 접수");
      expect(
        sql(
          `select count(*)from adme_privacy.requests where actor_id='${actor}';`,
        ),
      ).toBe("1");
      expect(payload).toBeDefined();
      const replay = await page.request.post("/api/account/deletion", {
        data: payload,
      });
      expect(replay.status()).toBe(200);
      await panel
        .getByRole("button", { name: "격리 처리 계속", exact: true })
        .click();
      await expect(panel.getByRole("status")).toContainText(
        "영구 파기는 완료되지 않았습니다",
      );
      expect((await admin.auth.admin.getUserById(actor)).data.user?.id).toBe(
        actor,
      );
      expect([401, 403]).toContain(
        (
          await page.request.patch("/api/account", {
            data: { name: "차단 확인" },
          })
        ).status(),
      );
      expect(
        (
          await page.request.post("/api/account/deletion/status", {
            data: { id: payload!.id, receipt: "0".repeat(64) },
          })
        ).status(),
      ).toBe(404);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `output/playwright/deletion-${role}-${info.project.name}.png`,
        fullPage: true,
      });
    } finally {
      sql(
        `delete from adme_privacy.quarantine_files where request_id in(select id from adme_privacy.requests where actor_id='${actor}');delete from adme_privacy.requests where actor_id='${actor}';delete from adme_ops.rate_windows where subject='${actor}';`,
      );
      expect((await admin.auth.admin.deleteUser(actor)).error).toBeNull();
    }
  });
