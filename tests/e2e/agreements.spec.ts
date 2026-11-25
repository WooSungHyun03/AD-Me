// D050 UI: a brand proposes collaboration terms, the creator sees them as unconfirmed and agrees; a later
// one-sided change keeps the agreed terms until the other party accepts; outsiders get 404.
import { qaSignupConsent } from "../support/consent-fixture.mjs";
import { ownerSql } from "../support/local-db-fixture";
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

test("terms: proposal needs the other party; agreed terms survive a new one-sided offer", async ({
  page,
  browser,
}) => {
  // Fixture: a fresh creator account and an accepted collaboration with the QA brand (owner SQL).
  const email = `adme-qa-d050ui-${randomUUID().slice(0, 8)}@example.com`,
    password = randomUUID() + "Aa!";
  const su = await createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  ).auth.signUp({
    email,
    password,
    options: { data: { ...qaSignupConsent, role: "creator", name: "조건 UI" } },
  });
  const creatorUser = su.data.user!.id,
    creatorId = `user-${creatorUser}`,
    campaign = randomUUID(),
    proposal = randomUUID();
  ownerSql(
    `insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${creatorUser}',true,profile from public.creators where id='creator-001';
     insert into public.campaigns(id,owner_id,brief) select '${campaign}','${accounts.brand.id}',brief from public.campaigns limit 1;
     insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status)
       values('${proposal}','${campaign}','${creatorId}','${accounts.brand.id}','${creatorUser}','proposal','D050 조건 합의 UI 검증','accepted');`,
  );
  try {
    await login(page, accounts.brand.email, accounts.brand.password);
    await page.goto(`/collaborations/${proposal}/terms`);
    const panel = page.getByTestId("agreement");
    await expect(panel).toContainText("아직 양측이 확인한 조건이 없습니다.");
    await panel.getByLabel("예산 (원, 비우면 미정)").fill("500000");
    await panel.getByLabel("산출물").fill("숏폼 1편");
    await panel.getByLabel("일정").fill("12월 둘째 주 게시");
    await panel.getByRole("button", { name: "조건 제안 보내기" }).click();
    await expect(page.getByTestId("agreement-pending")).toContainText(
      "상대 확인 대기 중인 제안",
    );
    await expect(panel).toContainText("아직 양측이 확인한 조건이 없습니다.");

    const cc = await browser.newContext();
    const cp = await cc.newPage();
    await login(cp, email, password);
    await cp.goto(`/collaborations/${proposal}/terms`);
    const pending = cp.getByTestId("agreement-pending");
    await expect(pending).toContainText("상대방이 보낸 조건 제안");
    await expect(pending).toContainText("500,000원");
    await pending.getByRole("button", { name: "이 조건에 동의" }).click();
    await expect(cp.getByTestId("agreement-pending")).toHaveCount(0);
    await expect(cp.getByTestId("agreement")).toContainText("양측 확인");

    // The creator proposes a change: the agreed 500,000원 stays until the brand agrees.
    const cpanel = cp.getByTestId("agreement");
    await cpanel.getByLabel("예산 (원, 비우면 미정)").fill("700000");
    await cpanel.getByRole("button", { name: "조건 제안 보내기" }).click();
    await expect(cp.getByTestId("agreement-pending")).toContainText(
      "700,000원",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "합의된 조건" }).locator(".."),
    ).toContainText("500,000원");
    await expect(
      page.getByTestId("agreement-history").locator("li"),
    ).toHaveCount(2);
    await cc.close();

    // An outsider cannot see the collaboration terms.
    const oc = await browser.newContext();
    const op = await oc.newPage();
    await login(op, accounts.other.email, accounts.other.password);
    // Streamed not-found may answer HTTP 200; assert the not-found UI and that no terms leak.
    await op.goto(`/collaborations/${proposal}/terms`);
    await expect(op.getByText("찾으시는 페이지가 없습니다.")).toBeVisible();
    await expect(op.getByTestId("agreement")).toHaveCount(0);
    await expect(op.locator("body")).not.toContainText("500,000원");
    await expect(op.locator("body")).not.toContainText("숏폼 1편");
    await oc.close();
  } finally {
    ownerSql(
      `delete from public.proposals where id='${proposal}'; delete from public.campaigns where id='${campaign}'; delete from public.creators where id='${creatorId}';`,
    );
  }
});
