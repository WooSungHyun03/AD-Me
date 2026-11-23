// D027 UI: a creator uploads a portfolio file from settings; a disguised file is refused; the owner downloads
// through a short signed URL; other accounts and anonymous calls get nothing; delete removes access.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
test.skip(
  !/^http:\/\/(127\.0\.0\.1|localhost):/.test(
    env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  ),
  "local Supabase only",
);
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82,
]);

test("private portfolio upload, download, isolation and delete", async ({
  page,
  browser,
  request,
}) => {
  expect((await request.post("/api/uploads")).status()).toBe(401);
  const email = `adme-qa-d027ui-${randomUUID().slice(0, 8)}@example.com`,
    password = randomUUID() + "Aa!";
  await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  ).auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role: "creator", name: "D027 크리에이터" } },
  });
  await login(page, email, password);
  await page.goto("/settings");
  const file = page.getByLabel("파일 선택");
  const rights = page.getByLabel(
    "직접 만들었거나 사용할 권리가 있는 파일입니다.",
  );
  const submit = page.getByRole("button", { name: "파일 올리기" });
  // Disguised HTML with an image extension.
  await file.setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("<html><script>alert(1)</script>"),
  });
  await rights.check();
  await submit.click();
  await expect(page.getByText("허용된 이미지·PDF 형식이 아닙니다")).toBeVisible();
  // SVG is refused by extension.
  await file.setInputFiles({
    name: "logo.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg onload=alert(1)>"),
  });
  await submit.click();
  await expect(page.getByText("PNG·JPG·WEBP·PDF 파일만")).toBeVisible();
  // Real PNG.
  await file.setInputFiles({
    name: "포트폴리오.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await submit.click();
  await expect(page.getByText("파일을 올렸습니다.")).toBeVisible();
  const item = page
    .getByTestId("upload-item")
    .filter({ hasText: "포트폴리오.png" });
  await expect(item).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    item.getByRole("button", { name: "내려받기" }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^file-[0-9a-f]{8}\.png$/);
  expect(readFileSync((await download.path())!)).toEqual(PNG);

  // Brand account: cannot upload, cannot get a link for the creator's file.
  const ids = await page.evaluate(
    async () =>
      await (
        await fetch("/api/uploads/" + "00000000-0000-4000-8000-000000000000", {
          method: "POST",
        })
      ).status,
  );
  expect(ids).toBe(404);
  const ownerFileId = await (async () => {
    const db = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { auth: { persistSession: false } },
    );
    await db.auth.signInWithPassword({ email, password });
    return (await db.from("uploads").select("id").single()).data!.id as string;
  })();
  const bc = await browser.newContext();
  const bp = await bc.newPage();
  await login(bp, accounts.brand.email, accounts.brand.password);
  const other = await bp.evaluate(async (id) => {
    const link = await fetch(`/api/uploads/${id}`, { method: "POST" });
    const del = await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    const fd = new FormData();
    fd.append(
      "file",
      new File(
        [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
        "a.png",
        { type: "image/png" },
      ),
    );
    fd.append("rights", "on");
    const up = await fetch("/api/uploads", { method: "POST", body: fd });
    const sweep = await fetch("/api/admin/uploads", { method: "POST" });
    return [link.status, del.status, up.status, sweep.status];
  }, ownerFileId);
  expect(other).toEqual([404, 404, 403, 403]);
  await bc.close();

  // Owner deletes; the file disappears and its link can no longer be issued.
  await item.getByRole("button", { name: "삭제" }).click();
  await expect(page.getByText("파일을 삭제했습니다.")).toBeVisible();
  await expect(page.getByTestId("upload-item")).toHaveCount(0);
  expect(
    await page.evaluate(
      async (id) =>
        (await fetch(`/api/uploads/${id}`, { method: "POST" })).status,
      ownerFileId,
    ),
  ).toBe(404);
});
