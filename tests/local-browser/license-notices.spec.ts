import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
test("shipped software notices match exact manifest and remain accessible on desktop/mobile", async ({
  page,
}) => {
  const manifest = JSON.parse(
    readFileSync("docs/licenses/20261121-shipping/manifest.json", "utf8"),
  );
  await page.goto("/licenses");
  await expect(
    page.getByRole("heading", { name: "오픈소스 고지", exact: true }),
  ).toBeVisible();
  const r = await page.request.get("/legal/third-party-notices.txt");
  expect(r.status()).toBe(200);
  const body = await r.body();
  expect(createHash("sha256").update(body).digest("hex")).toBe(manifest.sha256);
  expect(body.length).toBe(manifest.bytes);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
