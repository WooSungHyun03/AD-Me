// Real generated USER SQL, exact disposable local packet container only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
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
const mode = process.argv[2] ?? "current_19";
const counts = {
  current_19: 19,
  main_8: 8,
  integrated_12: 12,
  previous_16: 16,
  terms_18: 18,
};
assert.ok(mode in counts);
assert.equal(
  Number(sql("select count(*) from supabase_migrations.schema_migrations;")),
  counts[mode],
);
const packet = "deliverables/dev-a-read-boundary-20261120/user-apply";
const body = readFileSync(`${packet}/01_stage_${mode}.sql`, "utf8");
const owner = randomUUID(),
  id = `user-${owner}`;
try {
  const profile = JSON.stringify({
    ...JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
    name: "가상 staged QA",
    email: "FICTIONAL_PRIVATE_CANARY",
  }).replaceAll("'", "''");
  sql(`insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"가상 staged QA"}');
    insert into public.creators(id,owner_id,published,profile) values('${id}','${owner}',true,'${profile}'::jsonb);`);
  assert.equal(
    sql(`select count(*) from public.creators where id='${id}';`),
    "1",
  );
  const hash = () =>
    sql(
      "select md5(string_agg(id||profile::text,',' order by id)) from public.creators;",
    );
  const before = hash();
  if (mode === "current_19") {
    assert.throws(() =>
      sql("begin; revoke select on public.creators from anon;\n" + body),
    );
    assert.throws(() =>
      sql(
        "begin; insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');\n" +
          body,
      ),
    );
  }
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "23",
  );
  assert.equal(hash(), before);
  assert.equal(sql("select enabled from adme_creator.read_boundary;"), "f");
  assert.equal(
    sql("select has_table_privilege('anon','public.creators','select');"),
    "t",
  );
  // Old source's raw query still works while staging, including the known old
  // disclosure. This is compatibility evidence, NOT security completion.
  assert.match(
    sql(
      `begin; set local role anon; select count(*) from public.creators where id='${id}' and profile->>'email'='FICTIONAL_PRIVATE_CANARY'; rollback;`,
    ),
    /\b1\b/,
  );
  const safe = JSON.parse(sql("select public.creator_catalog_page('',200);"));
  assert.ok(safe.items.some((c) => c.seed_id === id));
  assert.ok(!JSON.stringify(safe).includes("FICTIONAL_PRIVATE_CANARY"));
  sql(
    "select adme_creator.activate_read_boundary('1111111111111111111111111111111111111111');",
  );
  assert.equal(sql("select enabled from adme_creator.read_boundary;"), "t");
  assert.equal(
    sql("select has_table_privilege('anon','public.creators','select');"),
    "f",
  );
  assert.throws(() =>
    sql("begin; set local role anon; select * from public.creators; rollback;"),
  );
  assert.throws(() =>
    sql(
      "begin; update adme_creator.read_boundary set enabled=false; rollback;",
    ),
  );
  assert.throws(() =>
    sql("begin; delete from adme_creator.read_boundary; rollback;"),
  );
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `select has_function_privilege('${role}','adme_creator.activate_read_boundary(text)','execute');`,
      ),
      "f",
    );
  const evidence = sql(
    "select activated_at::text||release_ref from adme_creator.read_boundary;",
  );
  sql(
    "select adme_creator.activate_read_boundary('2222222222222222222222222222222222222222');",
  );
  assert.equal(
    sql(
      "select activated_at::text||release_ref from adme_creator.read_boundary;",
    ),
    evidence,
  );
  assert.equal(hash(), before);
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    mode,
    from_migrations: counts[mode],
    to_migrations: 23,
    result: "PASS",
    unchanged_profile_hash: true,
    staging_retains_old_source_read: true,
    staging_is_not_security_completion: true,
    safe_rpc_excludes_private_canary: true,
    activation_closes_raw_anon_read: true,
    activation_is_owner_only_and_one_way: true,
    repeated_activation_evidence_preserved: true,
    duplicate_rejected: true,
    custom_hardening_and_unknown_history_rejected: mode === "current_19",
    scope: "generated SQL in exact local disposable DB; no hosted execution",
  };
  writeFileSync(
    `output/dev-a-packet-db/read-boundary-${mode}.local.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.creators where id='${id}'; delete from auth.users where id='${owner}';`,
  );
}
