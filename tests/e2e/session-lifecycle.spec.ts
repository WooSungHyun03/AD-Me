import { expect, test } from "@playwright/test";
import { localJwt } from "../support/local-qa.mjs";
import {
  installSession,
  localAccount,
  localSession,
  loginLocal,
} from "../support/local-session";

test("D013 global logout denies refresh and same-browser tabs; expired credentials recover through login", async ({
  page,
  baseURL,
}, info) => {
  for (const role of ["brand", "creator"] as const) {
    const a = await localAccount(role, "d013");
    const first = await localSession(a),
      other = await localSession(a);
    const otherRefresh = (await other.db.auth.getSession()).data.session!
      .refresh_token;
    try {
      await installSession(page, baseURL!, first);
      await page.goto("/dashboard");
      const tab = await page.context().newPage();
      await tab.goto("/settings");
      await expect(
        tab.getByRole("heading", { name: "나를 보여주는 방식." }),
      ).toBeVisible();
      await page.getByRole("button", { name: "로그아웃", exact: true }).click();
      await expect(page).toHaveURL(baseURL! + "/");
      expect(
        (await other.db.auth.refreshSession({ refresh_token: otherRefresh }))
          .error,
      ).not.toBeNull();
      await tab.reload();
      await expect(tab).toHaveURL(/\/login$/);
      expect(
        (
          await tab.request.post("/api/privacy/exports", {
            headers: { origin: baseURL! },
          })
        ).status(),
      ).toBe(401);
      await tab.goto("/admin");
      await expect(tab).toHaveURL(/\/login/);
      await tab.close();

      // Explicit expired-JWT fixture plus the actually revoked refresh token.
      // No waiting or weakening the server clock; this is local issuer-key QA only.
      const value =
        "base64-" +
        Buffer.from(
          JSON.stringify({
            access_token: localJwt(a.id, { exp: 1, iat: 0 }),
            refresh_token: otherRefresh,
            expires_at: 1,
            expires_in: 0,
            token_type: "bearer",
            user: { id: a.id },
          }),
        ).toString("base64url");
      await page
        .context()
        .addCookies([
          {
            name: first.cookies[0].name.replace(/\.\d+$/, ""),
            value,
            url: baseURL!,
          },
        ]);
      await page.goto("/settings");
      await expect(page).toHaveURL(/\/login$/);
      await loginLocal(page, a);
      await expect(page).toHaveURL(/\/settings$/);
      expect(
        (
          await page.request.post("/api/privacy/exports", {
            headers: { origin: baseURL! },
          })
        ).status(),
      ).toBe(201);
      await page.goto("/login?error=logout");
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "로그아웃을 완료하지 못했습니다" }),
      ).toBeVisible();
      if (role === "brand")
        await page.screenshot({
          path: `output/playwright/d013-logout-${info.project.name}.png`,
          fullPage: true,
        });
    } finally {
      await page.context().clearCookies();
      await a.admin.auth.admin.deleteUser(a.id);
    }
  }
});
