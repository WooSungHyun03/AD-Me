// D040: private notes stay with the owner; a shared comparison shows public fields only and can be revoked.
import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function login(page: Page, acc: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(acc.email);
  await page.getByLabel("비밀번호", { exact: true }).fill(acc.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("compare: private note, link share without notes, CSV, revoke", async ({
  page,
  browser,
}) => {
  const secret = `메모-${Date.now()}`;
  const title = `비교 ${Date.now()}`;
  await login(page, accounts.brand);
  await page.goto("/compare?ids=creator-001,creator-002,creator-003");
  await expect(
    page.getByTestId("compare-table").locator("thead th"),
  ).toHaveCount(4);
  await expect(page.getByTestId("compare-table")).toContainText("결측");
  const notes = page.getByTestId("private-notes");
  await notes.getByLabel(/서하린 비공개 메모/).fill(secret);
  await notes.getByRole("button", { name: "메모 저장" }).first().click();
  await expect(notes.getByText("저장했습니다.")).toBeVisible();
  await page.getByLabel("비교 제목").fill(title);
  await page.getByLabel("공유 범위").selectOption("link");
  await page.getByRole("button", { name: "비교 저장" }).click();
  const row = page.getByTestId("saved-compare").filter({ hasText: title });
  await expect(row).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("private-notes").getByLabel(/서하린 비공개 메모/),
  ).toHaveValue(secret);
  const shareHref = await row
    .getByRole("link", { name: "공유 링크" })
    .getAttribute("href");

  // Anonymous viewer of the link: public fields only, no note, no note editor.
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(shareHref!);
  await expect(anon.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(anon.getByTestId("compare-table")).toBeVisible();
  await expect(anon.locator("body")).not.toContainText(secret);
  await expect(anon.getByTestId("private-notes")).toHaveCount(0);
  const csv = await (
    await anon.request.get(`/api/compare?share=${shareHref!.split("=")[1]}`)
  ).text();
  expect(csv).toContain("creator-001");
  expect(csv).not.toContain(secret);

  // Another signed-in account opening the same link still gets no notes.
  const other = await (await browser.newContext()).newPage();
  await login(other, accounts.creator);
  await other.goto(shareHref!);
  await expect(other.locator("body")).not.toContainText(secret);

  // Revoke.
  await row.getByRole("button", { name: "공유 끄기" }).click();
  await expect(
    page.getByTestId("saved-compare").filter({ hasText: title }),
  ).toContainText("나만 보기");
  await anon.goto(shareHref!);
  await expect(
    anon.getByText("공유가 꺼졌거나 없는 링크입니다."),
  ).toBeVisible();
  // Clean up the note (wait for the save so no test data is left behind).
  const notesBox = page.getByTestId("private-notes");
  await notesBox.getByLabel(/서하린 비공개 메모/).fill("");
  await notesBox.getByRole("button", { name: "메모 저장" }).first().click();
  await expect(notesBox.getByText("저장했습니다.")).toBeVisible();
});
