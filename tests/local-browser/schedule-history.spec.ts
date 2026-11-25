import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  dropCreatorProfile,
  ensureCreatorProfile,
  localRuntime,
  sql,
} from "../support/local-qa.mjs";
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
async function login(page: Page, role: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill(accounts[role].email);
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill(accounts[role].password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
// The owner's edit goes through the real DB trigger (as the owner under RLS); the accept fixture bypasses guards.
test("D055 schedule changes are listed for the owner and the collaborator only", async ({
  page,
}, info) => {
  localRuntime();
  const campaign = randomUUID(),
    proposal = randomUUID();
  const own = ensureCreatorProfile(accounts.creator.id);
  const terms = (postingEnd: string) => ({
    version: 2,
    compensation: { mode: "unknown" },
    deliverables: [
      {
        format: "숏폼",
        quantity: 1,
        usageRights: "가상 30일",
        exclusivity: null,
      },
    ],
    recruitment: {
      start: "2027-03-01T00:00:00.000Z",
      end: "2027-03-02T00:00:00.000Z",
    },
    production: {
      start: "2027-03-03T00:00:00.000Z",
      end: "2027-03-05T00:00:00.000Z",
    },
    posting: { start: "2027-03-06T00:00:00.000Z", end: postingEnd },
  });
  try {
    sql(`set session_replication_role=replica;
      insert into public.campaigns(id,owner_id,brief,status,is_demo,moderation_status)
        select '${campaign}','${accounts.brand.id}',brief||jsonb_build_object('title','가상 D055 일정 이력 캠페인','terms','${JSON.stringify(terms("2027-03-08T00:00:00.000Z"))}'::jsonb),'published',false,'allowed'
        from public.campaigns where not is_demo order by created_at limit 1;
      insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,status,brief)
        values('${proposal}','${campaign}','${own.id}','${accounts.brand.id}','${accounts.creator.id}','proposal','accepted','가상 D055 일정 이력 화면 검증');`);
    sql(`begin; set local role authenticated;
      select set_config('request.jwt.claims','{"sub":"${accounts.brand.id}","role":"authenticated"}',true);
      update public.campaigns set brief=brief||jsonb_build_object('terms','${JSON.stringify(terms("2027-03-10T00:00:00.000Z"))}'::jsonb) where id='${campaign}';
      commit;`);
    // 2027-03-08 00:00Z = 09:00 KST; the summary shows the new end, the history shows old → new.
    const change =
      /게시 기간: .*2027\. 03\. 08\. 09:00 → .*2027\. 03\. 10\. 09:00/;
    for (const role of ["brand", "creator"]) {
      await login(page, role);
      await page.goto(`/campaigns/${campaign}`);
      const history = page.getByRole("region", { name: "일정 변경 이력" });
      await expect(history.getByText(change)).toBeVisible();
      await expect(history.getByText(/모집 기간|제작 기간/)).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
      await history.scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `output/playwright/d055-history-${role}-${info.project.name}.png`,
      });
    }
    await login(page, "other");
    await page.goto(`/campaigns/${campaign}`);
    await expect(
      page.getByRole("heading", { name: "협업 조건" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "일정 변경 이력" }),
    ).toHaveCount(0);
  } finally {
    sql(`set session_replication_role=replica;
      delete from public.proposals where id='${proposal}';
      delete from public.campaigns where id='${campaign}';`);
    dropCreatorProfile(own);
  }
});
