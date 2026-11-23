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
  "57",
);
const folder = "deliverables/dev-a-p0-all-20261121",
  body = readFileSync(folder + "/01_apply_current_57.sql", "utf8"),
  actor = randomUUID(),
  request = randomUUID();
const hash = () =>
  sql(
    `select md5(string_agg(v,','order by v))from(select 'creator:'||row_to_json(t)::text v from public.creators t union all select 'brand:'||row_to_json(t)::text from public.brand_profiles t union all select 'profile:'||row_to_json(t)::text from public.profiles t union all select 'event:'||row_to_json(t)::text from adme_consent.events t)q;`,
  );
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${actor}','{"role":"brand","name":"가상 삭제 패킷"}');insert into public.brand_profiles(owner_id,brand_name,industry,introduction,published)values('${actor}','가상 기존 브랜드','교육','기존 가상 자료',true);`,
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
      "begin;alter role authenticator set pgrst.db_pre_request='public.unreviewed_hook';\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      "begin;alter function adme_upload.room_allowed(uuid,boolean)security invoker;\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      body.replace(
        "-- SOURCE 202611210060",
        "select * from adme_deliberate_missing;\n-- SOURCE 202611210060",
      ),
    ),
  );
  assert.equal(hash(), before);
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "57",
  );
  assert.equal(sql("select to_regnamespace('adme_privacy')is null;"), "t");
  sql(body);
  assert.equal(hash(), before);
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "60",
  );
  assert.equal(sql("select enabled from adme_privacy.intake;"), "f");
  assert.equal(sql("select count(*)from adme_privacy.requests;"), "0");
  assert.equal(
    sql(
      "select public from storage.buckets where id='adme-privacy-quarantine';",
    ),
    "f",
  );
  assert.throws(() =>
    sql(
      `select public.deletion_accept('${actor}','${request}','${"a".repeat(64)}',clock_timestamp());`,
    ),
  );
  assert.equal(hash(), before);
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      sql(
        `select has_table_privilege('${role}','adme_privacy.requests','select')or has_table_privilege('${role}','adme_privacy.quarantine_files','select');`,
      ),
      "f",
    );
    assert.equal(
      sql(
        `select has_function_privilege('${role}','adme_privacy.actor_active(uuid)','execute');`,
      ),
      "f",
    );
  }
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 57,
    to_migrations: 60,
    unknown_history_modified_access_helper_or_custom_hook_rejected: true,
    mid_bundle_failure_atomic_rollback_including_role_setting: true,
    nonempty_original_creator_brand_profile_consent_preserved: true,
    intake_defaults_off_and_request_rejected: true,
    no_permanent_erasure_operation: true,
    quarantine_bucket_private: true,
    private_rows_and_arbitrary_actor_probes_denied: true,
    duplicate_apply_rejected: true,
    scope:
      "Actual generated57→60 SQL in independent marked loopback DB; fictional preexisting records. No hosted configuration/deployment/legal approval.",
  };
  writeFileSync(
    "harness/evidence/DEV-A-P0-ALL-20261121/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.brand_profiles where owner_id='${actor}';delete from auth.users where id='${actor}';`,
  );
}
