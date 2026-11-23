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
assert.match(config, /^port = 54332$/m);
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
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "31",
);
const target = "deliverables/dev-a-recommendations-20261120",
  body = readFileSync(`${target}/01_apply_current_31.sql`, "utf8").replaceAll(
    "\r\n",
    "\n",
  ),
  preflight = readFileSync(`${target}/00_preflight_current_31.sql`, "utf8");
const sources = [
  "202611200026_recommendation_snapshots.sql",
  "202611200027_recommendation_campaign_delete.sql",
  "202611200028_recommendation_read_budget.sql",
].map((name) => ({
  name,
  text: readFileSync(`supabase/migrations/${name}`, "utf8").replaceAll(
    "\r\n",
    "\n",
  ),
}));
for (const s of sources) assert.ok(body.includes(s.text));
const owner = randomUUID(),
  campaign = randomUUID(),
  key = randomUUID();
const digest = () =>
  sql(
    "select md5(jsonb_build_array((select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),(select jsonb_agg(to_jsonb(c) order by id) from public.creators c),(select jsonb_agg(to_jsonb(ca) order by id) from public.campaigns ca),(select jsonb_agg(to_jsonb(m) order by id) from public.messages m),(select to_jsonb(b) from adme_delivery.boundary b))::text);",
  );
try {
  const brief = rootSql(
    "select brief::text from public.campaigns limit 1;",
  ).replaceAll("'", "''");
  sql(
    `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${owner}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${owner}@example.test','fixture-only','{}','{"role":"brand","name":"Fictional upgrade QA"}',now(),now());insert into public.campaigns(id,owner_id,brief,is_demo) values('${campaign}','${owner}','${brief}',true);`,
  );
  const before = digest();
  assert.throws(
    () =>
      sql(
        "begin;insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');" +
          preflight.replace("begin;", "").replace("rollback;", "") +
          "rollback;",
      ),
    /STOP:/,
  );
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "31",
  );
  sql(preflight);
  const interrupted =
    body.slice(0, body.lastIndexOf("commit;")) + "select 1/0;commit;";
  assert.throws(() => sql(interrupted), /division by zero/);
  assert.equal(
    sql(
      "select coalesce(to_regnamespace('adme_recommendation')::text,'absent');",
    ),
    "absent",
  );
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "31",
  );
  assert.equal(digest(), before);
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "34",
  );
  assert.equal(digest(), before);
  assert.throws(() => sql(body), /STOP:/);
  const actor = (statement) =>
    sql(
      `begin;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${owner}","role":"authenticated"}',true);${statement};commit;`,
    )
      .split("\n")
      .filter((x) => /^[a-f0-9-]{36}$/.test(x));
  const id = actor(
    `select public.recommendation_create('${campaign}','${key}')`,
  )[0];
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(
    actor(`select public.recommendation_create('${campaign}','${key}')`)[0],
    id,
  );
  assert.equal(
    sql(`select count(*) from adme_recommendation.snapshots where id='${id}';`),
    "1",
  );
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `select has_table_privilege('${role}','adme_recommendation.snapshots','select');`,
      ),
      "f",
    );
  assert.equal(
    sql(
      "select relrowsecurity from pg_class where oid='adme_recommendation.snapshots'::regclass;",
    ),
    "t",
  );
  assert.equal(
    sql(
      "select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in('recommendation_create','recommendation_page') and not prosecdef and provolatile='v';",
    ),
    "2",
  );
  for (const helper of ["context", "context_unmetered"])
    assert.equal(
      sql(
        `select has_function_privilege('authenticated','adme_recommendation.${helper}(uuid)','execute');`,
      ),
      "f",
    );
  actor(`delete from public.campaigns where id='${campaign}'`);
  assert.equal(
    sql(`select count(*) from adme_recommendation.snapshots where id='${id}';`),
    "0",
  );
  writeFileSync(
    "output/dev-a-packet-db/recommendation-upgrade.local.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        result: "PASS",
        from_migrations: 31,
        to_migrations: 34,
        nonempty_profiles_creators_campaigns_messages_delivery_boundary_hash_preserved: true,
        interrupted_bundle_rolls_back_schema_and_ledger: true,
        unknown_and_repeat_rejected: true,
        owner_retry_rls_rpc_budget_privileges_and_campaign_delete_verified: true,
        sources: sources.map((s) => ({
          path: `supabase/migrations/${s.name}`,
          sha256_lf: createHash("sha256").update(s.text).digest("hex"),
        })),
        scope:
          "actual generated USER SQL in exact isolated packet DB; fictional account/campaign and role claims, no hosted execution",
      },
      null,
      2,
    ),
  );
  console.log(
    "PASS USER SQL31→34, atomic rollback, original hash, privileges, retry and existing campaign delete",
  );
} finally {
  sql(
    `delete from public.campaigns where id='${campaign}';delete from adme_ops.rate_windows where subject='${owner}';delete from auth.users where id='${owner}';`,
  );
}
