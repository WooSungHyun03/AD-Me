import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const sql = (query) =>
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
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: query, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "112",
);
const base = "deliverables/dev-a-recommendation-policy-20261123/",
  apply = readFileSync(base + "01_apply_112_to_113.sql", "utf8");
const prior = () =>
  sql(
    "select jsonb_build_object('creators',(select md5(coalesce(jsonb_agg(to_jsonb(c)order by id)::text,'[]'))from public.creators c),'campaigns',(select md5(coalesce(jsonb_agg(to_jsonb(c)order by id)::text,'[]'))from public.campaigns c),'snapshots',(select md5(coalesce(jsonb_agg(to_jsonb(s)-'held_count'order by id)::text,'[]'))from adme_recommendation.snapshots s),'resource',(select to_jsonb(c)from adme_ops.resource_controls c),'brief',(select to_jsonb(c)from adme_brief.controls c),'billing',(select to_jsonb(c)from adme_release.billing_boundary c),'scorer',md5(pg_get_functiondef('adme_recommendation.score_v1(jsonb,jsonb)'::regprocedure)))",
  );
const before = prior();
sql(readFileSync(base + "00_preflight_112.sql", "utf8"));
assert.throws(
  () => sql(apply.replace(/commit;\s*$/, () => "select 1/0;\ncommit;")),
  /division by zero/,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "112",
);
assert.equal(
  sql(
    "select to_regprocedure('public.recommendation_create_v12(uuid,uuid,boolean)')is null",
  ),
  "t",
);
assert.equal(
  sql(
    "select count(*)from information_schema.columns where table_schema='adme_recommendation'and table_name='snapshots'and column_name='held_count'",
  ),
  "0",
);
assert.equal(prior(), before);
sql(apply);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "113",
);
assert.equal(prior(), before);
assert.equal(
  sql(
    "select has_function_privilege('authenticated','public.recommendation_create_v12(uuid,uuid,boolean)','execute'),has_function_privilege('anon','public.recommendation_page_v12(uuid,uuid,boolean)','execute'),has_function_privilege('authenticated','adme_recommendation.context_v12(uuid,boolean)','execute'),has_table_privilege('authenticated','adme_recommendation.snapshots','select')",
  ),
  "t|f|f|f",
);
assert.throws(() => sql(apply), /STOP: v12 already exists/);
const manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8")),
  pending = manifest.pending[0];
assert.equal(
  sql(
    `select encode(sha256(convert_to(statements[1],'UTF8')),'hex')from supabase_migrations.schema_migrations where version='${pending.version}'`,
  ),
  pending.sha256,
);
sql(readFileSync(base + "02_verify.sql", "utf8"));
mkdirSync("harness/evidence/DEV-A-RECOMMENDATION-POLICY-20261123", {
  recursive: true,
});
writeFileSync(
  "harness/evidence/DEV-A-RECOMMENDATION-POLICY-20261123/packet-upgrade.json",
  JSON.stringify(
    {
      result: "PASS",
      baseline: 112,
      target: 113,
      baselineFunctions: 7,
      injectedFailureRollback: true,
      columnAndFunctionsRolledBack: true,
      legacyRowsFrozenScorerAndFlagsPreserved: true,
      repeatedApplyRejected: true,
      exactSourceReceipt: true,
      scope: "marked secondary local Postgres; no hosted actions",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS112→113 atomic failure rollback, legacy/scorer/flags unchanged, role grants, exact source receipt and replay rejection",
);
