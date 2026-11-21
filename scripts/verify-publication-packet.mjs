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
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "54",
);
const folder = "deliverables/dev-a-publication-20261121",
  body = readFileSync(folder + "/01_apply_current_54.sql", "utf8"),
  id = randomUUID(),
  event = randomUUID();
const hash = () =>
  sql(
    `select md5(string_agg(v,',' order by v))from(select 'creator:'||row_to_json(t)::text v from public.creators t union all select 'brand:'||row_to_json(t)::text from public.brand_profiles t union all select 'contact:'||row_to_json(t)::text from public.brand_contacts t union all select 'profile:'||row_to_json(t)::text from public.profiles t union all select 'event:'||row_to_json(t)::text from(select id,actor_id,version,purpose,accepted,method,request_key,recorded_at from adme_consent.events)t)q;`,
  );
const previous =
  sql("select active::text from adme_consent.policies;") +
  "|" +
  sql("select enabled from adme_release.billing_boundary;");
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${id}','{"role":"brand","name":"가상 이전 공개 QA"}');insert into public.brand_profiles(owner_id,brand_name,industry,introduction,published)values('${id}','가상 이전 브랜드','교육','가상 자료',true);insert into public.brand_contacts(owner_id,contact_name,contact_email)values('${id}','비공개 가상 담당','fictional@example.test');insert into adme_consent.events(id,actor_id,version,purpose,accepted,method,request_key)values('${event}','${id}','beta-20261121-1','profile_publication',false,'settings','${randomUUID()}');`,
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
      "begin;alter function public.save_brand_account(text,text,text,text,boolean,text,text,text)security invoker;\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      body.replace(
        "-- SOURCE 202611210057",
        "select * from adme_deliberate_missing;\n-- SOURCE 202611210057",
      ),
    ),
  );
  assert.equal(hash(), before);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "54",
  );
  assert.equal(
    sql("select to_regclass('adme_consent.publication_requests')is null;"),
    "t",
  );
  sql(body);
  assert.equal(hash(), before);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "57",
  );
  assert.equal(
    sql("select enabled from adme_consent.publication_boundary;"),
    "f",
  );
  assert.equal(
    sql(`select scope from adme_consent.events where id='${event}';`),
    "global",
  );
  assert.equal(
    sql("select count(*) from adme_consent.publication_requests;"),
    "0",
  );
  assert.equal(
    sql("select active::text from adme_consent.policies;") +
      "|" +
      sql("select enabled from adme_release.billing_boundary;"),
    previous,
  );
  // Run as actual local authenticator role with JWT context, not as fixture owner.
  const asActor = (statement) =>
    execFileSync(
      "docker",
      [
        "exec",
        "-e",
        "PGPASSWORD=postgres",
        "-i",
        "supabase_db_dev-a-packet-db",
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "authenticator",
        "-d",
        "postgres",
        "-Atq",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      {
        input: `begin;set local role authenticated;set local request.jwt.claims='{"sub":"${id}","role":"authenticated"}';${statement};commit;`,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();
  asActor(
    `select public.save_brand_account('가상 이전 공개 QA','가상 이전 브랜드','교육','가상 자료',true,'비공개 가상 담당','fictional@example.test','private')`,
  );
  assert.equal(
    sql(`select count(*) from adme_consent.events where actor_id='${id}';`),
    "1",
  );
  sql(readFileSync(folder + "/03_activate_after_source_review.sql", "utf8"));
  const first = sql(
    "select activated_at::text||release_ref from adme_consent.publication_boundary;",
  );
  sql(
    "select adme_consent.activate_publication('2222222222222222222222222222222222222222');",
  );
  assert.equal(
    sql(
      "select activated_at::text||release_ref from adme_consent.publication_boundary;",
    ),
    first,
  );
  assert.throws(() =>
    sql("update adme_consent.publication_boundary set enabled=false;"),
  );
  assert.throws(() =>
    asActor(
      `select public.save_brand_account('가상 이전 공개 QA','가상 이전 브랜드','교육','가상 자료',true,'비공개 가상 담당','fictional@example.test','private')`,
    ),
  );
  const brandId = sql(
    `select id from public.brand_profiles where owner_id='${id}';`,
  );
  asActor(
    `update public.brand_profiles set published=false where id='${brandId}'`,
  );
  assert.equal(
    sql(`select published from public.brand_profiles where owner_id='${id}';`),
    "f",
  );
  assert.equal(
    sql(
      `select count(*) from adme_consent.events where actor_id='${id}' and scope='brand' and not accepted;`,
    ),
    "1",
  );
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 54,
    to_migrations: 57,
    unknown_or_modified_baseline_rejected: true,
    mid_bundle_failure_atomic_rollback: true,
    nonempty_profiles_brands_contacts_creators_old_event_fields_preserved: true,
    old_events_default_global_without_fabricating_new_acceptance: true,
    prior_policy_and_test_billing_preserved: true,
    staged_legacy_write_without_synthetic_new_consent: true,
    strict_activation_owner_only_one_way_first_stamp_preserved: true,
    strict_legacy_publication_denied_but_privacy_restriction_available: true,
    duplicate_apply_rejected: true,
    scope:
      "Actual generated SQL and local authenticator role/JWT fixture in independent marked loopback DB. No hosted policy approval/deployment.",
  };
  writeFileSync(
    "harness/evidence/DEV-A-P0-PUBLICATION-20261121/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.brand_contacts where owner_id='${id}';delete from public.brand_profiles where owner_id='${id}';delete from adme_ops.rate_windows where subject='${id}';delete from auth.users where id='${id}';`,
  );
}
