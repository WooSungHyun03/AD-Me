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
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations;"),
  "60",
);
const body = readFileSync(
    "deliverables/dev-a-ready-20261122/01_apply_current_60.sql",
    "utf8",
  ),
  actor = randomUUID(),
  creator = "user-" + actor,
  identity = randomUUID(),
  policy = "packet-" + randomUUID(),
  hash = () =>
    sql(
      `select md5(string_agg(v,','order by v))from(select 'creator:'||row_to_json(c)::text v from public.creators c union all select 'profile:'||row_to_json(p)::text from public.profiles p union all select 'campaign:'||row_to_json(c)::text from public.campaigns c union all select 'ad:'||row_to_json(a)::text from public.ad_collaborations a union all select 'old_metric:'||(to_jsonb(m)-array['formula_text','sample_size','period_start','period_end'])::text from adme_creator.metric_observations m)q;`,
    );
const profile = JSON.stringify(
  JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
).replaceAll("'", "''");
const ledger = sql(
  "select md5(string_agg(to_jsonb(s)::text,','order by version))from supabase_migrations.schema_migrations s;",
);
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${actor}','{"role":"creator","name":"가상 P1 패킷"}');insert into public.creators(id,owner_id,published,profile)values('${creator}','${actor}',true,'${profile}');insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version)select '${identity}',id,'approved_web','fictional-${identity}','가상 패킷','https://example.test/fictional-packet',now(),'synthetic_demo','${policy}'from adme_creator.records where legacy_creator_id='${creator}';insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind)values('${identity}','views',0,'count',now(),'https://example.test/fictional-packet','${policy}','original');`,
  );
  const before = hash();
  assert.throws(() =>
    sql(
      "begin;insert into supabase_migrations.schema_migrations(version,name)values('209901010001','unknown');\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      "begin;alter role authenticator set pgrst.db_pre_request='public.unknown_hook';\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      "begin;alter function adme_creator.normalized_public(text)security invoker;\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      body.replace(
        "-- SOURCE 202611220066",
        "select *from adme_deliberate_missing;\n-- SOURCE 202611220066",
      ),
    ),
  );
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "60",
  );
  assert.equal(hash(), before);
  assert.equal(
    sql(
      "select to_regclass('adme_review.competitors')is null and to_regclass('adme_ops.support_audit')is null;",
    ),
    "t",
  );
  sql(body);
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "67",
  );
  assert.equal(hash(), before);
  assert.equal(
    sql(
      "select md5(string_agg(to_jsonb(s)::text,','order by version))from supabase_migrations.schema_migrations s where version<'202611220000';",
    ),
    ledger,
  );
  assert.equal(sql("select enabled from adme_privacy.intake;"), "f");
  assert.equal(
    sql(
      "select count(*)from adme_creator.publication_policies where derived_allowed or history_allowed;",
    ),
    "0",
  );
  for (const role of ["anon", "authenticated", "service_role"])
    for (const table of ["adme_review.competitors", "adme_ops.support_audit"])
      assert.equal(
        sql(`select has_table_privilege('${role}','${table}','select');`),
        "f",
      );
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 60,
    to_migrations: 67,
    unknown_history_custom_hook_modified_function_rejected: true,
    mid_bundle_failure_atomic_rollback: true,
    nonempty_profiles_creators_campaigns_ad_history_original_metric_values_preserved: true,
    old60_source_ledger_unchanged: true,
    private_tables_default_deny: true,
    policy_intake_not_activated: true,
    duplicate_apply_rejected: true,
    scope:
      "Actual generated USER SQL in independent marked loopback DB; fictional records, no hosted deployment/provider approval",
  };
  writeFileSync(
    "harness/evidence/DEV-A-READY-20261122/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.creators where id='${creator}';delete from auth.users where id='${actor}';`,
  );
}
