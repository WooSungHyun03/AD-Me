// D055: in-app deadline reminders on the actual local Postgres (fictional data only).
// The pg_cron body (adme_ops.scan_deadline_reminders) is called with an explicit clock instead of waiting an hour.
// Fixtures bypass the proposal/campaign guards (session_replication_role) because acceptance is covered elsewhere.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { localRuntime, sql } from "./support/local-qa.mjs";
localRuntime();
const brand = randomUUID(),
  creator = randomUUID(),
  other = randomUUID(),
  campaign = randomUUID(),
  proposal = randomUUID(),
  creatorId = `user-${creator}`;
const now = "2027-03-01T00:00:00Z";
const at = (hours) => new Date(Date.parse(now) + hours * 3600e3).toISOString();
// Same shape public.valid_campaign_terms enforces (version 2, minute-precision UTC).
const terms = (production, posting) => ({
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
  recruitment: { start: at(-240), end: at(-200) },
  production: { start: at(-190), end: production },
  posting: { start: at(-100), end: posting },
});
const setTerms = (production, posting) =>
  sql(`set session_replication_role=replica;
    update public.campaigns set brief=brief||jsonb_build_object('terms','${JSON.stringify(terms(production, posting))}'::jsonb) where id='${campaign}';`);
const scan = (clock = now) =>
  Number(
    sql(`select adme_ops.scan_deadline_reminders('${clock}'::timestamptz);`),
  );
const rows = () =>
  sql(
    `select coalesce(string_agg(user_id||'/'||status||'/'||to_char(due_at at time zone 'UTC','HH24'),',' order by user_id,status,due_at),'') from public.notifications where proposal_id='${proposal}' and kind='deadline';`,
  );
const seen = (user) =>
  sql(`begin; set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',true);
    select count(*) from public.notifications where kind='deadline' and proposal_id='${proposal}'; rollback;`)
    .split("\n")
    .at(-2); // last line is the ROLLBACK tag
let groups = 0;
try {
  for (const [id, role] of [
    [brand, "brand"],
    [creator, "creator"],
    [other, "brand"],
  ])
    sql(`insert into auth.users(id,raw_user_meta_data,confirmation_token,recovery_token,email_change,email_change_token_new)
      values('${id}','{"role":"${role}","name":"가상 D055 ${role}"}','','','','');`);
  sql(`set session_replication_role=replica;
    insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${creator}',true,
      profile||'{"is_demo":false,"name":"가상 D055 크리에이터"}'::jsonb from public.creators where id='creator-001';
    insert into public.campaigns(id,owner_id,brief,status,is_demo,moderation_status)
      select '${campaign}','${brand}',brief||'{"title":"가상 D055 캠페인"}'::jsonb,'published',false,'allowed'
      from public.campaigns where not is_demo order by created_at limit 1;
    insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,status,brief)
      values('${proposal}','${campaign}','${creatorId}','${brand}','${creator}','proposal','pending','가상 D055 일정 리마인더 검증');`);
  setTerms(at(10), at(30));
  // 1. Only the scheduler may run the scan; no client role can execute it.
  assert.equal(
    sql(
      "select has_function_privilege('authenticated','adme_ops.scan_deadline_reminders(timestamptz)','execute'),has_function_privilege('anon','adme_ops.scan_deadline_reminders(timestamptz)','execute'),has_function_privilege('service_role','adme_ops.scan_deadline_reminders(timestamptz)','execute');",
    ),
    "f|f|f",
  );
  assert.equal(
    sql(
      "select count(*) from cron.job where jobname='adme-deadline-reminders';",
    ),
    "1",
  );
  groups++;
  // 2. A proposal that is not an active collaboration gets nothing.
  assert.equal(scan(), 0);
  for (const s of ["rejected", "cancelled", "completed"]) {
    sql(
      `set session_replication_role=replica; update public.proposals set status='${s}' where id='${proposal}';`,
    );
    assert.equal(scan(), 0);
  }
  groups++;
  // 3. Active collaboration: production ends in 10 h → one reminder each for brand and creator; posting (30 h) waits.
  sql(
    `set session_replication_role=replica; update public.proposals set status='accepted' where id='${proposal}';`,
  );
  assert.equal(scan(), 2);
  assert.equal(
    rows(),
    [`${brand}/production/10`, `${creator}/production/10`].sort().join(","),
  );
  assert.equal(
    sql(
      `select count(*) from public.email_outbox where source_key in(select 'notification:'||id from public.notifications where proposal_id='${proposal}');`,
    ),
    "0",
  );
  groups++;
  // 4. Owner-only via RLS: each side sees its own reminder, an unrelated account sees none.
  assert.deepEqual([seen(brand), seen(creator), seen(other)], ["1", "1", "0"]);
  groups++;
  // 5. Repeated runs (hourly cron) never duplicate.
  assert.equal(scan(), 0);
  assert.equal(scan(at(1)), 0);
  groups++;
  // 6. Time boundaries: due exactly at now+24h is included, already-due is excluded.
  setTerms(at(-1), at(24));
  assert.equal(scan(), 2); // posting at +24h
  setTerms(at(-1), at(48));
  assert.equal(scan(at(48)), 0); // never reminded, but due exactly now: not upcoming
  groups++;
  // 7. A changed deadline reminds once more for the new time.
  setTerms(at(5), at(24));
  assert.equal(scan(), 2);
  assert.equal(scan(), 0);
  assert.equal(
    sql(
      `select count(distinct due_at) from public.notifications where proposal_id='${proposal}' and status='production';`,
    ),
    "2",
  );
  groups++;
  // 8. A concurrent run holding the job lock does nothing; the next run catches up.
  setTerms(at(6), at(24));
  const holder = spawn("docker", [
    "exec",
    "-i",
    localRuntime().DB_CONTAINER,
    "psql",
    "-U",
    "postgres",
    "-c",
    "begin; select pg_advisory_xact_lock(hashtext('adme-deadline-reminders')); select pg_sleep(3); commit;",
  ]);
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(scan(), 0);
  await new Promise((r) => holder.on("exit", r));
  assert.equal(scan(), 2);
  groups++;
  // 10. Recruitment close (earlier of terms end and recruit_until) reminds the campaign owner only.
  const recruitment = (user = null) =>
    sql(`begin; ${user ? `set local role authenticated; select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',true);` : ""}
      select coalesce(string_agg(to_char(due_at at time zone 'UTC','HH24'),',' order by due_at),'') from public.notifications
      where campaign_id='${campaign}' and kind='deadline' and status='recruitment'; rollback;`)
      .split("\n")
      .at(-2);
  const recruit = (end, until = "null") =>
    sql(`set session_replication_role=replica; update public.campaigns
      set brief=jsonb_set(brief,'{terms,recruitment,end}',to_jsonb('${end}'::text)),recruit_until=${until} where id='${campaign}';`);
  recruit(at(12));
  scan();
  assert.equal(recruitment(), "12");
  recruit(at(12), `'${at(6)}'`); // an earlier recruit_until is the effective close
  scan();
  scan();
  assert.equal(recruitment(), "06,12");
  assert.deepEqual(
    [recruitment(brand), recruitment(creator), recruitment(other)],
    ["06,12", "", ""],
  );
  sql(
    `set session_replication_role=replica; update public.campaigns set status='closed' where id='${campaign}';`,
  );
  recruit(at(20));
  scan();
  assert.equal(recruitment(), "06,12", "closed campaigns get no reminder");
  groups++;
  // 9. Deleting the collaboration removes its reminders.
  // Normal role: replica mode would also skip the FK cascade under test.
  sql(`delete from public.proposals where id='${proposal}';`);
  assert.equal(
    sql(
      `select count(*) from public.notifications where proposal_id='${proposal}';`,
    ),
    "0",
  );
  groups++;
  console.log(`PASS deadline reminders ${groups} groups`);
} finally {
  sql(`delete from public.notifications where proposal_id='${proposal}';
    set session_replication_role=replica;
    delete from public.proposals where id='${proposal}';
    delete from public.campaigns where id='${campaign}';
    delete from public.creators where id='${creatorId}';
    delete from auth.users where id in('${brand}','${creator}','${other}');`);
}
