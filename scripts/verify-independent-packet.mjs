import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomUUID, createHash } from "node:crypto";
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
const dir = "deliverables/dev-a-independent-20261122",
  manifest = JSON.parse(readFileSync(`${dir}/MANIFEST.json`, "utf8")),
  hash = (value) => createHash("sha256").update(value).digest("hex");
for (const f of manifest.files)
  assert.equal(hash(readFileSync(`${dir}/${f.path}`)), f.sha256_lf);
for (const f of manifest.sources)
  assert.equal(
    hash(readFileSync(f.path, "utf8").replaceAll("\r\n", "\n")),
    f.sha256_lf,
  );
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations;"),
  "67",
);
const body = readFileSync(`${dir}/01_apply_current_67.sql`, "utf8");
const actor = randomUUID(),
  creator = `user-${actor}`;
const profile = JSON.stringify(
  JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
).replaceAll("'", "''");
const dataHash = () =>
  sql(
    "select md5(string_agg(v,','order by v))from(select 'creator:'||row_to_json(c)::text v from public.creators c union all select 'profile:'||row_to_json(p)::text from public.profiles p union all select 'campaign:'||row_to_json(c)::text from public.campaigns c)q;",
  );
const ledgerHash = () =>
  sql(
    "select md5(string_agg(to_jsonb(s)::text,','order by version))from supabase_migrations.schema_migrations s where version<>'202611220068';",
  );
const ledger = ledgerHash(),
  intake = sql("select enabled from adme_privacy.intake;");
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${actor}','{"role":"creator","name":"가상 독립 패킷"}');insert into public.creators(id,owner_id,published,profile)values('${creator}','${actor}',false,'${profile}');`,
  );
  const before = dataHash();
  sql(readFileSync(`${dir}/00_preflight.sql`, "utf8"));
  for (const mutation of [
    "insert into supabase_migrations.schema_migrations(version,name)values('209901010001','unknown');",
    "update supabase_migrations.schema_migrations set name='modified',statements=array['changed']where version=(select min(version)from supabase_migrations.schema_migrations);",
    "alter role authenticator set pgrst.db_pre_request='public.unknown_hook';",
    "alter function public.account_access()security invoker;",
  ])
    assert.throws(() => sql("begin;" + mutation + body));
  assert.throws(() =>
    sql(
      body.replace(
        "notify pgrst,'reload schema';",
        "select *from deliberate_missing_packet_table;\nnotify pgrst,'reload schema';",
      ),
    ),
  );
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "67",
  );
  assert.equal(sql("select to_regnamespace('adme_search')is null;"), "t");
  assert.equal(dataHash(), before);
  assert.equal(ledgerHash(), ledger);
  sql(body);
  assert.equal(
    sql("select count(*)from supabase_migrations.schema_migrations;"),
    "68",
  );
  assert.equal(dataHash(), before);
  assert.equal(ledgerHash(), ledger);
  assert.equal(sql("select enabled from adme_privacy.intake;"), intake);
  assert.equal(
    sql(
      "select has_schema_privilege('authenticated','adme_search','usage'),has_table_privilege('authenticated','adme_search.saved_conditions','select'),has_function_privilege('anon','public.saved_search_list()','execute');",
    ),
    "f|f|f",
  );
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    from: 67,
    to: 68,
    result: "PASS",
    artifact_hashes: true,
    unknown_modified_history_function_hook_stop: true,
    atomic_rollback: true,
    nonempty_data_and_old_ledger_preserved: true,
    default_deny: true,
    unchanged_intake: true,
    duplicate_apply_stop: true,
    scope:
      "Actual generated USER SQL in marked independent local DB; fictional records; no hosted/provider verification.",
  };
  mkdirSync("harness/evidence/DEV-A-INDEPENDENT-20261122", { recursive: true });
  writeFileSync(
    "harness/evidence/DEV-A-INDEPENDENT-20261122/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.creators where id='${creator}';delete from auth.users where id='${actor}';`,
  );
}
