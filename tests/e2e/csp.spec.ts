// D077: real pages run with zero CSP violations (public, login, signed-in dashboard with realtime);
// the Toss TEST SDK origin is allowed while any other third-party script is blocked.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function watch(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(
        `${e.violatedDirective} ${e.blockedURI}`,
      ),
    );
  });
}
const violations = (page: Page) =>
  page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
const loadScript = (page: Page, src: string) =>
  page.evaluate(
    (s) =>
      new Promise<string>((res) => {
        const el = document.createElement("script");
        el.src = s;
        el.onload = () => res("loaded");
        el.onerror = () => res("error");
        document.head.appendChild(el);
        setTimeout(() => res("timeout"), 8000);
      }),
    src,
  );

test("pages, auth and realtime run without CSP violations; Toss allowed, others blocked", async ({
  page,
}) => {
  await watch(page);
  const res = await page.goto("/");
  expect(res!.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  for (const path of ["/creators", "/pricing", "/campaigns", "/login"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await violations(page), path).toEqual([]);
  }
  await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts.brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByTestId("unread-count")).toBeVisible(); // realtime badge mounted (websocket to Supabase)
  await page.waitForLoadState("networkidle");
  expect(await violations(page)).toEqual([]);
  // Toss SDK origin passes CSP (network result may vary offline, but no violation is recorded).
  await loadScript(page, "https://js.tosspayments.com/v2/standard");
  expect(
    (await violations(page)).filter((v) => v.includes("tosspayments")),
  ).toEqual([]);
  // Any other third-party script is blocked by CSP.
  expect(await loadScript(page, "https://example.com/evil.js")).toBe("error");
  expect(
    (await violations(page)).some(
      (v) => v.startsWith("script-src") && v.includes("example.com"),
    ),
  ).toBe(true);
});
