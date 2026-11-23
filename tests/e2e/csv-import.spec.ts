// D038: export carries ID + source; import is preview (no write) → confirm (valid rows only); another
// account's list is unreachable through both import and export.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseCsv } from "../../src/lib/csv";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("csv import: preview, partial commit, export round-trip, other account blocked", async ({
  page,
  browser,
}) => {
  await login(page, accounts.brand);
  const groupName = `CSV ${Date.now()}`;
  const made = await page.request.post("/api/lists", {
    data: { name: groupName },
  });
  expect(made.ok()).toBe(true);
  await page.goto("/lists");
  const panel = page.getByTestId("saved-list").filter({ hasText: groupName });
  await panel.getByText("CSV로 후보 가져오기").click();
  const csv = [
    "ID,이름,출처",
    "creator-001,서하린,DEMO",
    "creator-002,잘못된 출처,본인 등록",
    "https://instagram.com/someone,링크,DEMO",
    '"=HYPERLINK(""https://evil"")",수식,DEMO',
    "creator-001,중복,DEMO",
  ].join("\r\n");
  await panel.getByLabel(`${groupName} CSV 파일`).setInputFiles({
    name: "후보.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("﻿" + csv, "utf8"),
  });
  await panel.getByRole("button", { name: "미리보기" }).click();
  const preview = panel.getByTestId("import-preview");
  await expect(preview.locator("li")).toHaveCount(5);
  await expect(
    panel.getByText("추가 가능 1 · 이미 있음 0 · 오류 4"),
  ).toBeVisible();
  await expect(preview).toContainText("출처가 다릅니다(실제: DEMO)");
  await expect(preview).toContainText("수집하지 않음");
  // Preview wrote nothing.
  await page.reload();
  await expect(
    page.getByTestId("saved-list").filter({ hasText: groupName }),
  ).toContainText("아직 담긴 크리에이터가 없습니다");
  await panel.getByText("CSV로 후보 가져오기").click();
  await panel
    .getByLabel(`${groupName} CSV 파일`)
    .setInputFiles({
      name: "후보.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csv),
    });
  await panel.getByRole("button", { name: "미리보기" }).click();
  await panel.getByRole("button", { name: "확인 후 추가" }).click();
  await expect(panel.getByRole("status").last()).toContainText(
    "1명을 추가했습니다. 오류 4행은 추가하지 않았습니다.",
  );
  await expect(
    page.getByTestId("saved-list").filter({ hasText: groupName }),
  ).toContainText("서하린");

  // Export round-trip: ID + 출처 + basis, and re-importing it reports "이미 있음".
  const listId = await page
    .getByTestId("saved-list")
    .filter({ hasText: groupName })
    .locator("a[href^='/api/export?list=']")
    .getAttribute("href");
  const id = listId!.split("=")[1];
  const exported = await (
    await page.request.get(`/api/export?list=${id}`)
  ).text();
  const table = parseCsv(exported);
  expect(table[0]).toEqual([
    "ID",
    "이름",
    "분야",
    "분위기",
    "최소견적",
    "출처",
    "출처 근거",
  ]);
  expect(table[1][0]).toBe("creator-001");
  expect(table[1][5]).toBe("DEMO");
  const again = await (
    await page.request.post("/api/import", {
      data: { action: "preview", listId: id, csv: exported },
    })
  ).json();
  expect(again.summary).toEqual({ ok: 0, exists: 1, error: 0 });

  // Another account: cannot preview/commit into this list nor export it.
  const other = await (await browser.newContext()).newPage();
  await login(other, accounts.creator);
  const denied = await other.request.post("/api/import", {
    data: { action: "commit", listId: id, csv: "ID,출처\ncreator-003,DEMO" },
  });
  expect(denied.status()).toBe(404);
  expect(
    parseCsv(await (await other.request.get(`/api/export?list=${id}`)).text()),
  ).toHaveLength(1);
  expect(
    (
      await page.request.post("/api/import", {
        data: { action: "preview", listId: id, csv: "a".repeat(10) },
      })
    ).status(),
  ).toBe(422);
});
