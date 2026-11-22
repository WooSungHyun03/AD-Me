// D079: retention-period notice is public; the retention/re-apply controls are admin-only and record a run.
import { test, expect, type Page } from "@playwright/test";
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
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test("privacy notice lists retention periods without horizontal scroll", async ({
  page,
}) => {
  await page.goto("/privacy");
  const table = page.getByTestId("retention-table");
  await expect(table).toContainText("종료(거절·취소·완료) 후 3년");
  await expect(table).toContainText("복구 시 삭제 표시를 다시 적용");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("retention controls: non-admin refused, admin runs job and re-apply", async ({
  page,
  browser,
}) => {
  const other = await browser.newPage();
  await login(other, accounts.brand);
  for (const action of ["run", "snapshot", "reapply"])
    expect(
      (
        await other.request.post("/api/admin/retention", { data: { action } })
      ).status(),
    ).toBe(403);
  await other.close();

  await login(page, accounts.admin);
  await page.goto("/admin");
  const before = await page.getByTestId("retention-run").count();
  await page.getByRole("button", { name: "보존 작업 실행" }).click();
  await expect(page.getByText("보존 작업을 실행했습니다.")).toBeVisible();
  await expect(page.getByTestId("retention-run")).toHaveCount(
    Math.min(before + 1, 5),
  );
  await expect(page.getByTestId("retention-run").first()).toContainText("완료");
  expect(
    (
      await page.request.post("/api/admin/retention", {
        data: { action: "snapshot" },
      })
    ).ok(),
  ).toBe(true);
  await page.getByRole("button", { name: "복구 후 삭제 재적용" }).click();
  await expect(page.getByText("삭제 표시를 다시 적용했습니다.")).toBeVisible();
  expect(
    (
      await page.request.post("/api/admin/retention", {
        data: {
          action: "reapply",
          ledger: [
            {
              subject_kind: "upload",
              subject_id: "x",
              key_hashes: ["url:raw"],
              requested_at: "2026-01-01",
            },
          ],
        },
      })
    ).status(),
  ).toBe(400);
});
