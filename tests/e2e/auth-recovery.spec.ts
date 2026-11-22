// D010/D013: real reset mail through local Supabase + Mailpit. Skipped unless MAILPIT_URL is set
// (production has no mail sink; this never runs against the public URL).
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const MAILPIT = process.env.MAILPIT_URL;
test.skip(!MAILPIT, "MAILPIT_URL not set (local Supabase only)");
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const anon = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );

async function mailLink(to: string) {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`,
    );
    const { messages } = await r.json();
    if (messages?.length) {
      const m = await (
        await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)
      ).json();
      const link = (m.Text as string).match(
        /https?:\/\/\S+\/auth\/v1\/verify\S+/,
      )?.[0];
      if (link) return link.replace(/&amp;/g, "&").replace(/[)\]>]+$/, "");
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error("reset mail not delivered to Mailpit");
}

test("password reset: no enumeration, one-time link, recovery-only update, old password revoked", async ({
  page,
}) => {
  const email = `adme-qa-reset-${randomUUID().slice(0, 8)}@example.com`;
  const oldPw = randomUUID() + "Aa!";
  const newPw = randomUUID() + "Bb!";
  expect(
    (await anon().auth.signUp({ email, password: oldPw })).error,
  ).toBeNull();

  // Same answer for unknown and known accounts.
  await page.goto("/auth/forgot");
  await page
    .getByLabel("가입한 이메일")
    .fill(`nobody-${randomUUID().slice(0, 6)}@example.com`);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  const unknownMsg = await page.getByRole("status").innerText();
  await page.goto("/auth/forgot");
  await page.getByLabel("가입한 이메일").fill(email);
  await page.getByRole("button", { name: "재설정 링크 받기" }).click();
  await expect(page.getByRole("status")).toHaveText(unknownMsg);

  // Without a recovery link, the reset page refuses.
  await page.goto("/auth/reset");
  await expect(page.locator("p[role=alert]")).toContainText("만료");

  const link = await mailLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/auth\/reset$/);
  await page.getByLabel("새 비밀번호", { exact: true }).fill(newPw);
  await page.getByLabel("새 비밀번호 확인").fill(newPw);
  await page.getByRole("button", { name: "비밀번호 변경" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  // Reusing the same link fails.
  await page.context().clearCookies();
  await page.goto(link);
  await expect(page).toHaveURL(/\/login\?error=link(#.*)?$/);

  expect(
    (await anon().auth.signInWithPassword({ email, password: oldPw })).error,
  ).not.toBeNull();
  expect(
    (await anon().auth.signInWithPassword({ email, password: newPw })).error,
  ).toBeNull();
});

test("login returns only to allowed paths", async ({ page }) => {
  const email = `adme-qa-next-${randomUUID().slice(0, 8)}@example.com`;
  const pw = randomUUID() + "Aa!";
  await anon().auth.signUp({ email, password: pw });
  for (const [next, want] of [
    ["/settings", /\/settings$/],
    ["https://evil.example/x", /\/dashboard$/],
  ] as const) {
    await page.context().clearCookies();
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await page.getByLabel("이메일", { exact: true }).fill(email);
    await page.getByLabel("비밀번호", { exact: true }).fill(pw);
    await page.getByRole("button", { name: "로그인" }).click();
    await expect(page).toHaveURL(want);
  }
});
