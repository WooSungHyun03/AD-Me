// Exact marked secondary local database; this tool never loads hosted keys or acts on a cloud project.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
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
  "109",
);
const base = "deliverables/dev-a-brief-files-20261123/";
const apply = readFileSync(base + "01_apply_109_to_112.sql", "utf8");
sql(readFileSync(base + "00_preflight_109.sql", "utf8"));
const legacy = () =>
  sql(
    "select jsonb_build_object('creators',coalesce((select md5(string_agg(id||profile::text,','order by id))from public.creators),'empty'),'campaigns',coalesce((select md5(string_agg(id::text||brief::text,','order by id))from public.campaigns),'empty'),'controls',(select to_jsonb(c)from adme_ops.resource_controls c),'billing',(select enabled from adme_release.billing_boundary))::text",
  );
const before = legacy();
assert.throws(
  () => sql(apply.replace(/commit;\s*$/, () => "select 1/0;\ncommit;")),
  /division by zero/,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "109",
);
assert.equal(sql("select to_regnamespace('adme_brief')is null"), "t");
assert.equal(
  sql("select count(*)from storage.buckets where id='adme-campaign-briefs'"),
  "0",
);
sql(apply);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "112",
);
assert.equal(
  sql(
    "select enabled::text||':'||(policy_ref is null)::text||':'||(retention_days is null)::text from adme_brief.controls",
  ),
  "false:true:true",
);
assert.equal(
  sql(
    "select has_function_privilege('authenticated','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute'),has_function_privilege('service_role','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute'),has_table_privilege('authenticated','adme_brief.files','select')",
  ),
  "f|t|f",
);
assert.equal(legacy(), before);
assert.throws(() => sql(apply), /STOP: brief namespace\/bucket already exists/);
sql(readFileSync(base + "02_verify.sql", "utf8"));
writeFileSync(
  "harness/evidence/DEV-A-BRIEF-FILES-20261123/packet-upgrade.json",
  JSON.stringify(
    {
      result: "PASS",
      baseline: 109,
      target: 112,
      injectedFailureRollback: true,
      namespaceAndBucketRolledBack: true,
      collectionRemainsOff: true,
      legacyRowsAndFlagsPreserved: true,
      repeatedApplyRejected: true,
      scope:
        "marked secondary local Postgres; no hosted application/deployment or policy approval",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS reviewed109→112 atomic packet, rollback, default-OFF, unchanged rows/flags and repeat rejection",
);
