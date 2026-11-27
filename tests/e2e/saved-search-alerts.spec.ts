import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { localAccounts, localRuntime, sql } from "../support/local-qa.mjs";
const accounts = localAccounts();
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts.brand.password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test("D037 saved search opt-in announces only newly matching creators in the inbox", async ({
  page,
}, info) => {
  localRuntime();
  const marker = `가상D037UI${randomUUID().slice(0, 6)}`,
    name = `가상 알림 ${info.project.name}`,
    users: string[] = [];
  const publish = (label: string) => {
    const user = randomUUID();
    users.push(user);
    sql(`insert into auth.users(id,raw_user_meta_data,confirmation_token,recovery_token,email_change,email_change_token_new)
      values('${user}','{"role":"creator","name":"${marker}"}','','','','');
      insert into public.creators(id,owner_id,published,profile) select 'user-${user}','${user}',true,
      profile||jsonb_build_object('name','${marker} ${label}','is_demo',false,'owner_consent',true) from public.creators where id='creator-001';`);
  };
  try {
    publish("기존");
    await login(page);
    await page.goto(`/saved-searches?q=${encodeURIComponent(marker)}`);
    await page.getByLabel("저장 검색 이름").fill(name);
    await page.getByRole("button", { name: "현재 조건 저장" }).click();
    const item = page.getByRole("listitem").filter({ hasText: name });
    const toggle = item.getByRole("checkbox", { name: "새 후보 알림" });
    await expect(toggle).not.toBeChecked();
    await toggle.click(); // controlled by the saved state: it flips only after the server confirms

    await expect(item).toContainText("수정 2");
    await expect(toggle).toBeChecked();
    expect(sql("select adme_search.scan_alerts();")).toBe("0"); // opt-in baseline: the existing match is silent
    publish("신규");
    expect(sql("select adme_search.scan_alerts();")).toBe("1");
    await page.screenshot({
      path: `output/playwright/d037-saved-search-${info.project.name}.png`,
      fullPage: true,
    });
    await page.goto("/notifications");
    const alert = page.getByTestId("notification").filter({
      hasText: "저장 검색 조건에 새로 맞는 크리에이터 1명이 있습니다",
    });
    await expect(alert).toHaveCount(1);
    await expect(alert).toHaveAttribute("data-unread", "true");
    await expect(alert.getByRole("link")).toHaveAttribute(
      "href",
      "/saved-searches",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d037-notifications-${info.project.name}.png`,
    });
    await alert.getByRole("link").click();
    await expect(page).toHaveURL(/\/saved-searches$/);
    await expect(
      page.getByRole("listitem").filter({ hasText: name }),
    ).toHaveCount(1);
  } finally {
    sql(`delete from adme_search.saved_conditions where owner_id='${accounts.brand.id}' and name='${name}';
      delete from public.creators where id in(${users.map((u) => `'user-${u}'`).join(",") || "''"});
      delete from auth.users where id in(${users.map((u) => `'${u}'`).join(",") || "null"});
      delete from adme_ops.rate_windows where scope in('saved_search_write','saved_search_read','creator_catalog') and subject='${accounts.brand.id}';`);
  }
});
