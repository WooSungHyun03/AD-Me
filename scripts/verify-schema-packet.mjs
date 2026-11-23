// Generated USER SQL applied only to the exact disposable local packet container.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
const mode = process.argv[2] ?? "terms_18";
const expected = {
  main_8: 8,
  integrated_12: 12,
  previous_16: 16,
  terms_18: 18,
}[mode];
assert.ok(expected);
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
assert.equal(
  Number(sql("select count(*) from supabase_migrations.schema_migrations;")),
  expected,
);
const packet = "deliverables/dev-a-schema-20261120/user-apply";
const hash = () =>
  sql(
    "select md5(string_agg(id||profile::text,',' order by id)) from public.creators;",
  );
const before = hash();
const controls =
  expected >= 16
    ? sql(
        "select ingestion_enabled::text||','||llm_enabled::text from adme_ops.resource_controls;",
      )
    : "false,false";
const gate = readFileSync(`${packet}/00_preflight_${mode}.sql`, "utf8");
const apply = readFileSync(`${packet}/01_apply_${mode}.sql`, "utf8");
// Wrong version history must reject without changing the schema.
assert.throws(() =>
  sql(
    `begin; insert into supabase_migrations.schema_migrations(version,name) values('209901010001','wrong_fixture'); ${gate} rollback;`,
  ),
);
sql(gate);
sql(apply);
sql(readFileSync(`${packet}/02_verify.sql`, "utf8"));
assert.equal(
  Number(sql("select count(*) from supabase_migrations.schema_migrations;")),
  19,
);
assert.equal(hash(), before);
assert.equal(
  sql("select count(*) from adme_creator.records;"),
  sql("select count(*) from public.creators;"),
);
assert.equal(sql("select count(*) from adme_creator.identities;"), "0");
assert.equal(
  sql("select count(*) from adme_creator.metric_observations;"),
  "0",
);
assert.equal(
  sql(
    "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_creator' and c.relkind='r' and c.relrowsecurity;",
  ),
  "3",
);
assert.equal(
  sql(
    "select ingestion_enabled::text||','||llm_enabled::text from adme_ops.resource_controls;",
  ),
  controls,
);
for (const role of ["anon", "authenticated", "service_role"])
  for (const table of ["records", "identities", "metric_observations"])
    assert.equal(
      sql(
        `select has_table_privilege('${role}','adme_creator.${table}','select') or has_table_privilege('${role}','adme_creator.${table}','insert') or has_table_privilege('${role}','adme_creator.${table}','update') or has_table_privilege('${role}','adme_creator.${table}','delete');`,
      ),
      "f",
    );
assert.equal(
  sql(
    "select prosecdef from pg_proc where oid='public.my_creator_identity_snapshot()'::regprocedure;",
  ),
  "f",
);
assert.throws(() => sql(gate));
assert.throws(() => sql(apply));
// Optional pause is reversible within this test transaction; retain final grants.
sql(
  `begin; ${readFileSync(`${packet}/03_pause_snapshot.sql`, "utf8")} do $test$ begin if has_function_privilege('authenticated','public.my_creator_identity_snapshot()','execute') then raise exception 'pause failed'; end if; end $test$; rollback;`,
);
const receipt = {
  at: new Date().toISOString(),
  mode,
  before_migrations: expected,
  after_migrations: 19,
  result: "PASS",
  legacy_profile_hash_unchanged: true,
  mappings_complete: true,
  invented_identities: 0,
  new_rls_tables: 3,
  direct_table_privileges_denied: 9,
  public_security_invoker: true,
  resource_controls_preserved_or_default_off: true,
  wrong_baseline_rejected: true,
  duplicate_rejected: true,
  optional_pause_verified_and_rolled_back: true,
  scope:
    "generated USER SQL in exact local disposable packet DB; no hosted changes",
};
writeFileSync(
  `output/dev-a-packet-db/schema-${mode}.local.json`,
  JSON.stringify(receipt, null, 2),
);
console.log(JSON.stringify(receipt));
