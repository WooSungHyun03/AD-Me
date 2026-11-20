import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
import { localRuntime, sql as rootSql } from "./support/local-qa.mjs";
localRuntime();
const config = readFileSync(
  "output/dev-a-packet-db/supabase/config.toml",
  "utf8",
);
assert.match(config, /^project_id = "dev-a-packet-db"$/m);
assert.match(config, /port = 54332/);
const sql = (input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_dev-a-packet-db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const count = Number(process.argv[2]);
assert.ok([23, 24].includes(count));
assert.equal(
  Number(sql("select count(*) from supabase_migrations.schema_migrations;")),
  count,
);
const target = "deliverables/dev-a-evidence-20261120",
  mode = count === 23 ? "previous_23" : "current_24",
  body = readFileSync(`${target}/01_apply_${mode}.sql`, "utf8");
const brand = randomUUID(),
  owner = randomUUID(),
  creatorId = `user-${owner}`,
  campaign = randomUUID(),
  room = randomUUID(),
  report = randomUUID();
const js = (value) => JSON.stringify(value).replaceAll("'", "''"),
  profile = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
  brief = JSON.parse(
    rootSql("select brief::text from public.campaigns limit 1;"),
  );
try {
  for (const [id, role] of [
    [brand, "brand"],
    [owner, "creator"],
  ])
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${role}","name":"가상 자료 upgrade QA"}');`,
    );
  sql(`insert into public.creators(id,owner_id,published,profile) values('${creatorId}','${owner}',true,'${js(profile)}');insert into public.campaigns(id,owner_id,brief) values('${campaign}','${brand}','${js(brief)}');
 insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${creatorId}','${brand}','${owner}','proposal','Fictional review upgrade compatibility','accepted');
 insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${brand}','FICTIONAL historical message','message');
 insert into public.reports(id,reporter_id,creator_id,reason,source_url) values('${report}','${brand}','${creatorId}','FICTIONAL historical report','https://example.test/fixture-old-report');`);
  const hash = () =>
    sql(
      `select md5((select string_agg((to_jsonb(m)-'idempotency_key')::text,',' order by id) from public.messages m where proposal_id='${room}')||(select to_jsonb(r)::text from public.reports r where id='${report}')||(select profile::text from public.creators where id='${creatorId}'));`,
    );
  const before = hash(),
    boundary = sql(
      "select enabled::text||','||has_table_privilege('anon','public.creators','select')::text from adme_creator.read_boundary;",
    );
  assert.ok(before.length === 32);
  sql(readFileSync(`${target}/00_preflight_${mode}.sql`, "utf8"));
  assert.throws(() =>
    sql(
      "begin;insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');\n" +
        body,
    ),
  );
  sql(body);
  assert.equal(
    Number(sql("select count(*) from supabase_migrations.schema_migrations;")),
    30,
  );
  assert.equal(hash(), before);
  assert.equal(
    sql(
      "select enabled::text||','||has_table_privilege('anon','public.creators','select')::text from adme_creator.read_boundary;",
    ),
    boundary,
  );
  assert.equal(
    sql("select enabled::text||','||ad_enabled::text from adme_review.policy;"),
    "false,false",
  );
  assert.equal(
    sql(
      "select count(*) from pg_class c where c.relnamespace='adme_review'::regnamespace and c.relkind='r' and c.relrowsecurity;",
    ),
    "5",
  );
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `select count(*) from pg_class c where c.relnamespace='adme_review'::regnamespace and c.relkind='r' and has_table_privilege('${role}',c.oid,'select');`,
      ),
      "0",
    );
  const legacy =
    sql(`begin;set local role authenticated;set local request.jwt.claims='{"sub":"${brand}","role":"authenticated"}';
 insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${brand}','FICTIONAL valid legacy post upgrade','message');
 insert into public.reports(reporter_id,creator_id,reason,source_url) values('${brand}','${creatorId}','FICTIONAL legacy report post upgrade','https://example.test/legacy-valid');
 select count(*) from public.messages where proposal_id='${room}';rollback;`);
  assert.match(legacy, /\b2\b/);
  assert.throws(() => sql(body));
  assert.equal(hash(), before);
  const manifest = JSON.parse(readFileSync(`${target}/MANIFEST.json`, "utf8"));
  for (const record of manifest.new_migrations) {
    const s = readFileSync(record.path, "utf8").replaceAll("\r\n", "\n");
    assert.equal(
      createHash("sha256").update(s).digest("hex"),
      record.sha256_lf,
    );
    assert.ok(body.replaceAll("\r\n", "\n").includes(s));
  }
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: count,
    to_migrations: 30,
    nonempty_legacy_message_report_profile_hash_preserved: true,
    legacy_authenticated_message_and_report_insert_preserved: true,
    old_read_boundary_and_grants_unchanged: true,
    issue_and_ad_policy_both_default_off: true,
    private_tables_all_RLS_and_no_client_select: true,
    unknown_and_repeat_rejected: true,
    full_migration_sources_match_lf_hashes: true,
    scope:
      "actual generated USER SQL in exact isolated packet DB; fictional data only; no hosted changes",
  };
  writeFileSync(
    `output/dev-a-packet-db/review-upgrade-${count}.local.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.reports where id='${report}';delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';delete from public.creators where id='${creatorId}';delete from auth.users where id in ('${brand}','${owner}');`,
  );
}
