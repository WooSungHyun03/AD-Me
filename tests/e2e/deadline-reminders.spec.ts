import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { localAccounts, localRuntime, sql } from "../support/local-qa.mjs";
const accounts = localAccounts();
// Fixtures bypass acceptance guards (covered by their own suites); the reminder job body runs with the real clock.
test("D055 an active collaboration's upcoming deadline appears in the inbox in KST", async ({
  page,
}, info) => {
  localRuntime();
  const creator = randomUUID(),
    campaign = randomUUID(),
    proposal = randomUUID();
  const hour = 3600e3,
    minute = (t: number) => new Date(Math.floor(t / 60e3) * 60e3).toISOString();
  const now = Date.now();
  const terms = {
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
      start: minute(now - 300 * hour),
      end: minute(now + 3 * hour), // recruitment closes soon: brand-only reminder
    },
    production: {
      start: minute(now - 200 * hour),
      end: minute(now + 6 * hour),
    },
    posting: { start: minute(now - 100 * hour), end: minute(now + 72 * hour) },
  };
  try {
    sql(`insert into auth.users(id,raw_user_meta_data,confirmation_token,recovery_token,email_change,email_change_token_new)
        values('${creator}','{"role":"creator","name":"가상 D055 UI"}','','','','');
      set session_replication_role=replica;
      insert into public.creators(id,owner_id,published,profile) select 'user-${creator}','${creator}',true,
        profile||'{"is_demo":false,"name":"가상 D055 UI 크리에이터"}'::jsonb from public.creators where id='creator-001';
      insert into public.campaigns(id,owner_id,brief,status,is_demo,moderation_status)
        select '${campaign}','${accounts.brand.id}',brief||jsonb_build_object('title','가상 D055 UI 캠페인','terms','${JSON.stringify(terms)}'::jsonb),'published',false,'allowed'
        from public.campaigns order by is_demo, created_at limit 1; -- a fresh CI DB has only demo campaigns
      insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,status,brief)
        values('${proposal}','${campaign}','user-${creator}','${accounts.brand.id}','${creator}','proposal','accepted','가상 D055 일정 리마인더 화면 검증');`);
    // Other local campaigns may also be due; count only this fixture's rows.
    const mine = () =>
      sql(
        `select count(*) from public.notifications where proposal_id='${proposal}' or campaign_id='${campaign}';`,
      );
    sql("select adme_ops.scan_deadline_reminders();");
    expect(mine()).toBe("3"); // production: brand + creator, recruitment: brand
    sql("select adme_ops.scan_deadline_reminders();");
    expect(mine()).toBe("3");
    await page.goto("/login");
    await page.getByLabel("이메일", { exact: true }).fill(accounts.brand.email);
    await page
      .getByLabel("비밀번호", { exact: true })
      .fill(accounts.brand.password);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/notifications");
    const fmt = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const due = fmt.format(new Date(terms.production.end));
    const alert = page.getByTestId("notification").filter({
      hasText: `제작 마감이 24시간 안에 다가옵니다 · ${due} (KST)`,
    });
    await expect(alert).toHaveCount(1);
    await expect(alert).toHaveAttribute("data-unread", "true");
    await expect(alert.getByRole("link")).toHaveAttribute(
      "href",
      `/dashboard#proposal-${proposal}`,
    );
    const recruit = page.getByTestId("notification").filter({
      hasText: `모집 마감이 24시간 안에 다가옵니다 · ${fmt.format(new Date(terms.recruitment.end))} (KST)`,
    });
    await expect(recruit).toHaveCount(1);
    await expect(recruit.getByRole("link")).toHaveAttribute(
      "href",
      `/campaigns/${campaign}`,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `output/playwright/d055-deadline-${info.project.name}.png`,
    });
  } finally {
    sql(`delete from public.notifications where proposal_id='${proposal}' or campaign_id='${campaign}';
      set session_replication_role=replica;
      delete from public.proposals where id='${proposal}';
      delete from public.campaigns where id='${campaign}';
      delete from public.creators where id='user-${creator}';
      delete from auth.users where id='${creator}';`);
  }
});
