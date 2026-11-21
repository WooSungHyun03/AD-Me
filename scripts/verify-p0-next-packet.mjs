// Developer-only proof on the marked independent loopback packet database.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const config = readFileSync(
  "output/dev-a-packet-db/supabase/config.toml",
  "utf8",
);
assert.match(config, /^project_id = "dev-a-packet-db"$/m);
assert.match(config, /port = 54332/);
const sql = (input, role = "postgres") =>
  execFileSync(
    "docker",
    [
      "exec",
      "-e",
      "PGPASSWORD=postgres", // Disposable CLI-local database password only.
      "-i",
      "supabase_db_dev-a-packet-db",
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      role,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const folder = "deliverables/dev-a-p0-next-20261121",
  body = readFileSync(folder + "/01_apply_current_46.sql", "utf8"),
  doc = JSON.parse(readFileSync("src/lib/policy-document.json", "utf8"));
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "46",
);
const owner = randomUUID(),
  brand = randomUUID(),
  id = "user-" + owner,
  campaign = randomUUID(),
  room = randomUUID(),
  order = randomUUID(),
  job = randomUUID(),
  channel = "UC" + randomUUID().replaceAll("-", "").slice(0, 22),
  legacyNew = randomUUID(),
  acknowledged = randomUUID();
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const profile = {
    ...JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
    is_demo: false,
    name: "가상 패킷 계정",
    private_note: "FICTIONAL_PRIVATE_CANARY",
  },
  brief = JSON.parse(readFileSync("fixtures/campaigns.demo.json", "utf8"))[0];
const hash = () =>
  sql(`select md5(string_agg(v,',' order by v))from(
 select 'creator:'||row_to_json(t)::text v from public.creators t union all select 'campaign:'||row_to_json(t)::text from public.campaigns t
 union all select 'proposal:'||row_to_json(t)::text from public.proposals t union all select 'message:'||row_to_json(t)::text from public.messages t
 union all select 'order:'||row_to_json(t)::text from public.orders t
 union all select 'job:'||row_to_json(t)::text from(select id,kind,owner_id,input,status,attempts,available_at,lease_until,lease,output,error_code,created_at,finished_at,elapsed_ms from adme_ops.jobs)t
 union all select 'channel:'||row_to_json(t)::text from(select channel_id,title,subscriber_count,videos,review,fetched_at from adme_ops.channels)t)q;`);
try {
  sql(`insert into auth.users(id,raw_user_meta_data)values('${owner}','{"role":"creator","name":"가상 패킷"}'),('${brand}','{"role":"brand","name":"가상 패킷 브랜드"}');
 insert into public.creators(id,owner_id,published,profile)values('${id}','${owner}',true,'${literal(profile)}');
 insert into public.campaigns(id,owner_id,brief)values('${campaign}','${brand}','${literal(brief)}');
 insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status)values('${room}','${campaign}','${id}','${brand}','${owner}','proposal','Fictional preserved packet collaboration','accepted');
 insert into public.messages(proposal_id,sender_id,body,kind)values('${room}','${owner}','Fictional preserved message','message');
 insert into public.orders(id,owner_id,sku,amount)select '${order}','${brand}',sku,amount from public.products where role='brand' limit 1;
 update adme_ops.resource_controls set ingestion_enabled=true;insert into adme_ops.jobs(id,kind,owner_id,input,available_at)values('${job}','youtube_channel','${owner}','${channel}',now()+interval '2 days');update adme_ops.resource_controls set ingestion_enabled=false;
 insert into adme_ops.channels(channel_id,title,videos)values('${channel}','가상 이전 캐시','[]');`);
  const before = hash();
  assert.throws(() =>
    sql(
      "begin;insert into supabase_migrations.schema_migrations(version,name)values('209901010001','unknown');\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      "begin;alter function adme_ops.ops_worker_claim(text) security invoker;\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      body.replace(
        "-- SOURCE 202611210054",
        "select * from adme_deliberate_missing_relation;\n-- SOURCE 202611210054",
      ),
    ),
  );
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "46",
  );
  assert.equal(sql("select to_regnamespace('adme_consent') is null;"), "t");
  assert.equal(hash(), before, "rollback retained legacy entities");
  console.log("PASS rejected history/function/mid-bundle with rollback");
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "54",
  );
  assert.equal(hash(), before, "upgrade retained legacy entities");
  console.log("PASS actual54 upgrade retained legacy entities");
  assert.equal(sql("select enabled from adme_consent.boundary;"), "f");
  assert.equal(sql("select active from adme_consent.policies;"), "f");
  assert.equal(
    sql("select count(*) from adme_ops.source_runtime_policies;"),
    "0",
  );
  assert.equal(sql(`select adme_ops.channel_fresh('${channel}');`), "f");
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${legacyNew}','{"role":"brand","name":"가상 구버전 가입"}');`,
    "supabase_auth_admin",
  );
  console.log("PASS staged legacy signup");
  assert.equal(
    sql(
      `select count(*) from adme_consent.events where actor_id='${legacyNew}';`,
    ),
    "0",
  );
  sql(
    `select adme_consent.approve('${doc.version}','${doc.documentHash}','FICTIONAL packet approval only, not legal review');`,
  );
  const meta = {
    role: "brand",
    name: "가상 새버전 가입",
    policy_version: doc.version,
    policy_hash: doc.documentHash,
    terms_accepted: true,
    privacy_accepted: true,
    adult_beta_confirmed: true,
  };
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${acknowledged}','${literal(meta)}');`,
    "supabase_auth_admin",
  );
  assert.equal(
    sql(
      `select count(*) from adme_consent.events where actor_id='${acknowledged}';`,
    ),
    "3",
  );
  sql(readFileSync(folder + "/03_activate_after_source_review.sql", "utf8"));
  assert.throws(() =>
    sql(
      `insert into auth.users(id,raw_user_meta_data)values('${randomUUID()}','{"role":"brand","name":"가상 누락 확인"}');`,
      "supabase_auth_admin",
    ),
  );
  const first = sql(
    "select activated_at::text||release_ref from adme_consent.boundary;",
  );
  sql(
    "select adme_consent.activate_boundary('2222222222222222222222222222222222222222');",
  );
  assert.equal(
    sql("select activated_at::text||release_ref from adme_consent.boundary;"),
    first,
  );
  assert.throws(() => sql("update adme_consent.boundary set enabled=false;"));
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `select has_function_privilege('${role}','adme_consent.activate_boundary(text)','execute');`,
      ),
      "f",
    );
  sql("update adme_consent.policies set active=false;");
  assert.equal(hash(), before);
  assert.equal(sql("select enabled from adme_release.billing_boundary;"), "f");
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 46,
    to_migrations: 54,
    nonempty_legacy_profiles_campaigns_proposals_messages_orders_jobs_channels_preserved: true,
    unknown_history_or_modified_function_stop: true,
    mid_bundle_failure_atomic_rollback: true,
    duplicate_apply_rejected: true,
    stage_retains_legacy_signup_without_fabricating_consent: true,
    stage_is_policy_or_security_completion: false,
    acknowledged_new_source_records_three_purposes_during_stage: true,
    activation_owner_only_one_way_first_stamp_preserved: true,
    active_boundary_denies_missing_acknowledgements: true,
    policy_and_ingestion_defaults_off: true,
    old_unreviewed_cache_hidden_without_erasing_original_rows: true,
    scope:
      "Actual generated SQL in marked independent loopback DB; Auth DB role simulated for rollout. Actual GoTrue exercised separately in local-consent-security. No hosted operation/legal/provider approval.",
  };
  writeFileSync(
    "harness/evidence/DEV-A-P0-NEXT-20261121/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from adme_ops.jobs where id='${job}';delete from adme_ops.channels where channel_id='${channel}';delete from public.orders where id='${order}';delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';delete from public.creators where id='${id}';delete from adme_ops.rate_windows where subject='${owner}';delete from auth.users where id in('${owner}','${brand}','${legacyNew}','${acknowledged}');`,
  );
}
