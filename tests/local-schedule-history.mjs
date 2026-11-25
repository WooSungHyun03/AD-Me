// D055: campaign schedule change history on the actual local Postgres (fictional data only).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { localRuntime, sql } from "./support/local-qa.mjs";
localRuntime();
const brand = randomUUID(),
  creator = randomUUID(),
  other = randomUUID(),
  campaign = randomUUID(),
  proposal = randomUUID(),
  creatorId = `user-${creator}`;
const at = (h) =>
  new Date(Date.parse("2027-03-01T00:00:00Z") + h * 3600e3).toISOString();
const terms = (postingEnd, cash = 100000) => ({
  version: 2,
  compensation: {
    mode: "declared",
    cash: { minimumKrw: cash, maximumKrw: cash },
  },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "가상 30일",
      exclusivity: null,
    },
  ],
  recruitment: { start: at(0), end: at(24) },
  production: { start: at(48), end: at(96) },
  posting: { start: at(120), end: postingEnd },
});
// Updates run as the owner through PostgREST-equivalent RLS so actor_id is the real auth.uid().
const asUser = (user, statement) =>
  sql(`begin; set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',true);
    ${statement}; commit;`);
const setTerms = (t) =>
  asUser(
    brand,
    `update public.campaigns set brief=brief||jsonb_build_object('terms','${JSON.stringify(t)}'::jsonb) where id='${campaign}'`,
  );
const history = () =>
  sql(
    `select count(*) from public.campaign_schedule_changes where campaign_id='${campaign}';`,
  );
const seen = (user) =>
  sql(`begin; set local role authenticated;
    select set_config('request.jwt.claims','{"sub":"${user}","role":"authenticated"}',true);
    select count(*) from public.campaign_schedule_changes where campaign_id='${campaign}'; rollback;`)
    .split("\n")
    .at(-2);
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
      profile||'{"is_demo":false}'::jsonb from public.creators where id='creator-001';
    insert into public.campaigns(id,owner_id,brief,status,is_demo,moderation_status)
      select '${campaign}','${brand}',(brief-'terms')||'{"title":"가상 D055 일정 이력"}'::jsonb,'draft',false,'allowed'
      from public.campaigns where not is_demo order by created_at limit 1;`);
  // 1. Structuring a legacy campaign for the first time is not a change.
  setTerms(terms(at(168)));
  assert.equal(history(), "0");
  groups++;
  // 2. Non-schedule edits (compensation) and no-op saves are not recorded.
  setTerms(terms(at(168), 200000));
  setTerms(terms(at(168), 200000));
  assert.equal(history(), "0");
  groups++;
  // 3. A deadline change records previous/next windows and the acting owner.
  setTerms(terms(at(192), 200000));
  assert.equal(
    sql(`select actor_id='${brand}', previous->'posting'->>'end', next->'posting'->>'end', next ? 'compensation'
      from public.campaign_schedule_changes where campaign_id='${campaign}';`),
    `t|${at(168).replace(".000Z", ".000Z")}|${at(192)}|f`,
  );
  groups++;
  // 4. Read scope: owner and proposal parties only; unrelated accounts and anon see nothing.
  assert.deepEqual([seen(brand), seen(creator), seen(other)], ["1", "0", "0"]);
  sql(`set session_replication_role=replica;
    insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,status,brief)
      values('${proposal}','${campaign}','${creatorId}','${brand}','${creator}','proposal','accepted','가상 D055 일정 이력 검증');`);
  assert.deepEqual([seen(brand), seen(creator), seen(other)], ["1", "1", "0"]);
  assert.equal(
    sql(
      `select has_table_privilege('anon','public.campaign_schedule_changes','select');`,
    ),
    "f",
  );
  groups++;
  // 5. Append-only for clients: no insert/update/delete, even for the owner.
  for (const stmt of [
    `insert into public.campaign_schedule_changes(campaign_id,previous,next) values('${campaign}','{}','{}')`,
    `update public.campaign_schedule_changes set next='{}' where campaign_id='${campaign}'`,
    `delete from public.campaign_schedule_changes where campaign_id='${campaign}'`,
  ])
    assert.throws(() => asUser(brand, stmt), /permission denied/);
  assert.equal(history(), "1");
  groups++;
  // 6. Removing structured terms stays blocked (existing guard) and leaves history intact.
  assert.throws(
    () =>
      asUser(
        brand,
        `update public.campaigns set brief=brief-'terms' where id='${campaign}'`,
      ),
    /cannot be silently removed/,
  );
  assert.equal(history(), "1");
  groups++;
  console.log(`PASS schedule change history ${groups} groups`);
} finally {
  sql(`set session_replication_role=replica;
    delete from public.proposals where id='${proposal}';
    delete from public.campaigns where id='${campaign}';
    delete from public.creators where id='${creatorId}';
    delete from auth.users where id in('${brand}','${creator}','${other}');`);
}
