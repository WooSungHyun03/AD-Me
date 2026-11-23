// Developer-only exact marked secondary QA DB. No hosted credential access.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
const sql = (statement) =>
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
    { input: statement, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "105",
);
const name = "20261123055918_youtube_directory_topic_projection.sql";
const source = readFileSync("supabase/migrations/" + name, "utf8").replace(
  /\r\n/g,
  "\n",
);
// Baseline was produced by the installed CLI plus the already-reviewed105 source.
assert.ok(source.includes("Source-provided topics"));
const base = "deliverables/dev-a-sequential-20261123-v2/";
const preflight = readFileSync(base + "00_preflight_105.sql", "utf8");
const apply = readFileSync(base + "01_apply_105_to_109.sql", "utf8");
sql(preflight);
const state = () =>
  sql(
    "select jsonb_build_object('creator',coalesce((select md5(string_agg(id||profile::text,','order by id))from public.creators),'empty'),'campaign',coalesce((select md5(string_agg(id::text||brief::text,','order by id))from public.campaigns),'empty'),'controls',(select to_jsonb(c)from adme_ops.resource_controls c),'billing',(select enabled from adme_release.billing_boundary))::text",
  );
const before = state();
assert.throws(
  () => sql(apply.replace(/commit;\s*$/, "select 1/0;\ncommit;")),
  /division by zero/,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "105",
);
assert.equal(
  sql(
    "select to_regprocedure('public.youtube_directory_page(jsonb,text,integer)')is null",
  ),
  "t",
);
sql(apply);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "109",
);
assert.equal(state(), before);
assert.equal(
  sql(
    "select has_function_privilege('anon','public.youtube_directory_page(jsonb,text,integer)','execute'),has_function_privilege('anon','public.toggle_saved_creator(text)','execute'),has_function_privilege('authenticated','public.serve_promotion_slots(boolean)','execute'),has_function_privilege('service_role','public.serve_promotion_slots(boolean)','execute')",
  ),
  "t|f|f|t",
);
assert.throws(() => sql(apply), /STOP: history\/source mismatch/);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "109",
);
sql(readFileSync(base + "02_verify.sql", "utf8"));
writeFileSync(
  "harness/evidence/DEV-A-SEQUENTIAL-20261123/packet-upgrade.json",
  JSON.stringify(
    {
      result: "PASS",
      baseline: 105,
      target: 109,
      exactSourcePreflight: true,
      injectedFailureAtomicRollback: true,
      repeatedApplyRejected: true,
      legacyRowHashesAndControlFlagsPreserved: true,
      scope:
        "secondary marked local DB; no hosted configuration, migration application or deployment",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS exact105→109 packet, atomic rollback, unchanged data/flags and repeat rejection",
);
