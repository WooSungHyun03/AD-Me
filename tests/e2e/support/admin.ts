import { expect, type Page } from "@playwright/test";
import { totp } from "../../support/local-qa.mjs";

export async function verifyAdminOtp(page: Page, secret: string) {
  if (!secret)
    throw new Error("A local administrator TOTP fixture is required");
  await page.goto("/admin/security");
  await page.getByLabel("6자리 OTP").fill(totp(secret));
  await page.getByRole("button", { name: "OTP 확인", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}
