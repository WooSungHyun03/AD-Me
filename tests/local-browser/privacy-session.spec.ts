import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import {
  ageLocalSession,
  installSession,
  localAccount,
  localSession,
  loginLocal,
} from "../support/local-session";

test("D074 both roles reauthenticate current session then download own data once", async ({
  page,
  baseURL,
}, info) => {
  for (const role of ["brand", "creator"] as const) {
    const a = await localAccount(role, "d074");
    try {
      const stale = await localSession(a);
      await ageLocalSession(stale);
      await localSession(a); // Another login updates account last_sign_in_at only.
      await installSession(page, baseURL!, stale);
      await page.goto("/settings");
      const button = page.getByRole("button", {
        name: "내 데이터 내보내기 (JSON)",
        exact: true,
      });
      await button.click();
      await expect(
        page.getByRole("alert").filter({ hasText: "다시 로그인" }),
      ).toBeVisible();
      await page
        .getByRole("link", { name: "다시 로그인하기 →", exact: true })
        .click();
      await loginLocal(page, a);
      await expect(page).toHaveURL(/\/settings$/);
      const download = page.waitForEvent("download");
      await button.click();
      const file = await download;
      const data = JSON.parse(await readFile((await file.path())!, "utf8"));
      expect(data.format).toBe("adme-personal-data-export/1");
      expect(data.account.email).toBe(a.email);
      expect(JSON.stringify(data)).not.toMatch(
        /"(?:token_hash|payment_key|service_role|code_hash)"/,
      );
      await expect(
        page
          .getByRole("status")
          .filter({ hasText: "내 데이터 파일을 내려받았습니다" }),
      ).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (role === "brand")
        await button.locator("..").screenshot({
          path: `output/playwright/d074-export-${info.project.name}.png`,
        });
      const ticket = await page.request.post("/api/privacy/exports", {
        headers: { origin: baseURL! },
      });
      expect(ticket.status()).toBe(201);
      const body = await ticket.json();
      const options = {
        headers: { origin: baseURL! },
        data: { id: body.id, token: body.token },
      };
      expect(
        (await page.request.post("/api/privacy/download", options)).status(),
      ).toBe(200);
      expect(
        (await page.request.post("/api/privacy/download", options)).status(),
      ).toBe(410);
    } finally {
      await page.context().clearCookies();
      await a.admin.auth.admin.deleteUser(a.id);
    }
  }
});
