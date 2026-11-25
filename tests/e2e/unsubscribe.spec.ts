import { verifyAdminOtp } from "./support/admin";
// D053: unsubscribe link — opening it (GET / prefetch) changes nothing; the button or a mail client's
// RFC 8058 one-click POST turns that purpose off; a bad token is refused; admin sees sender not configured.
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const prefs = async () =>
  (
    await svc
      .from("profiles")
      .select("service_email,marketing_email")
      .eq("id", accounts.creator.id)
      .single()
  ).data!;
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test.describe.configure({ mode: "serial" });
test("unsubscribe: GET is inert, button and one-click POST turn mail off, bad token refused", async ({
  page,
}) => {
  const before = await prefs();
  await svc
    .from("profiles")
    .update({
      service_email: true,
      marketing_email: true,
      marketing_version: "marketing-2026-11",
    })
    .eq("id", accounts.creator.id);
  try {
    const token = (
      await svc.rpc("unsubscribe_token", {
        p_user: accounts.creator.id,
        p_purpose: "marketing",
      })
    ).data as string;
    await page.goto(`/unsubscribe?t=${encodeURIComponent(token)}`);
    await expect(
      page.getByRole("heading", { name: "메일 수신 거부." }),
    ).toBeVisible();
    expect((await prefs()).marketing_email).toBe(true); // opening the link alone does nothing
    await page.getByRole("button", { name: "수신 거부" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "마케팅 메일 수신을 껐습니다.",
    );
    expect((await prefs()).marketing_email).toBe(false);

    const service = (
      await svc.rpc("unsubscribe_token", {
        p_user: accounts.creator.id,
        p_purpose: "service",
      })
    ).data as string;
    const oneClick = await page.request.post(
      `/api/email/unsubscribe?t=${encodeURIComponent(service)}`,
      {
        form: { "List-Unsubscribe": "One-Click" },
      },
    );
    expect(oneClick.status()).toBe(200);
    expect((await prefs()).service_email).toBe(false);

    await page.goto(
      `/unsubscribe?t=${encodeURIComponent(token.slice(0, -2) + "00")}`,
    );
    await page.getByRole("button", { name: "수신 거부" }).click();
    await expect(page.getByRole("status")).toContainText("잘못되었거나 만료된");
    await page.goto("/unsubscribe");
    await expect(
      page.getByText("수신거부 링크가 올바르지 않습니다."),
    ).toBeVisible();
  } finally {
    await svc.from("profiles").update(before).eq("id", accounts.creator.id);
  }
  await login(page, accounts.admin);
  await verifyAdminOtp(page, accounts.admin.totpSecret);
  await page.goto("/admin");
  await expect(page.getByTestId("outbox")).toContainText("발송 공급자 미설정");
  expect((await page.request.post("/api/admin/email-outbox")).status()).toBe(
    200,
  );
  expect(
    await (await page.request.post("/api/admin/email-outbox")).json(),
  ).toMatchObject({ blocked: "메일 발송 공급자 미설정", sent: 0 });
});
