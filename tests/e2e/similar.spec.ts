// D032: tag-based similar profiles (demo only beside demo, shared tags as the reason) and a per-profile
// deletion request that survives sign-in.
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
test("similar profiles and deletion request entry", async ({ page }) => {
  await page.goto("/creators/creator-001");
  const links = page.getByTestId("similar").getByRole("link");
  await expect(links).toHaveCount(3);
  for (const href of await links.evaluateAll((a) =>
    a.map((x) => x.getAttribute("href")),
  ))
    expect(href).toMatch(/^\/creators\/creator-\d{3}$/);
  await expect(page.getByTestId("similar")).toContainText("공통 태그: 분야");
  await expect(page.getByTestId("similar")).not.toContainText(/팔로워|원/);

  await page.getByRole("link", { name: "이 프로필 삭제 요청" }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts.brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(
    /\/reports\/new\?creator=creator-001&kind=deletion$/,
  );
  await expect(page.getByLabel("요청 유형")).toHaveValue("deletion");
});
