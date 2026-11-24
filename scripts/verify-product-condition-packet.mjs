import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";
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
  "113",
);
const base = "deliverables/dev-a-product-conditions-20261124/",
  apply = readFileSync(base + "01_apply_113_to_116.sql", "utf8"),
  manifest = JSON.parse(readFileSync(base + "manifest.json", "utf8"));
for (const [name, hash] of Object.entries(manifest.files))
  assert.equal(
    createHash("sha256")
      .update(readFileSync(base + name))
      .digest("hex"),
    hash,
  );
// Nonempty fictional legacy rows make preservation checks meaningful. Never run against hosted DB.
sql(readFileSync("supabase/seed.sql", "utf8"));
const actor = randomUUID(),
  product = randomUUID();
sql(`insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('${actor}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${actor}@example.test','local-fixture-only','{}','{"role":"brand","name":"Fictional packet QA"}',now(),now());
insert into public.brand_products(id,owner_id,name,description)values('${product}','${actor}','가상 보존 검증 상품','패킷 적용 전후 그대로 보존되는 로컬 가상 상품입니다.');
update public.campaigns set owner_id='${actor}'where seed_id='campaign-001';
insert into adme_recommendation.snapshots(campaign_id,owner_id,request_key,model_version,source_contract,source_version,input,catalog_count,eligible_count,results)select id,'${actor}',gen_random_uuid(),'adme-1.0','public-catalog-v1','FICTIONAL frozen source','{"fixture":"legacy input"}',0,0,'[]'from public.campaigns where seed_id='campaign-001';`);
const prior = () =>
  sql(
    "select jsonb_build_object('creators',(select md5(jsonb_agg(to_jsonb(c)order by id)::text)from public.creators c),'campaigns',(select md5(jsonb_agg(to_jsonb(c)order by id)::text)from public.campaigns c),'products',(select md5(jsonb_agg(to_jsonb(c)order by id)::text)from public.brand_products c),'profiles',(select md5(jsonb_agg(to_jsonb(c)order by id)::text)from public.profiles c),'snapshots',(select md5(jsonb_agg(to_jsonb(c)order by id)::text)from adme_recommendation.snapshots c),'resource',(select to_jsonb(c)from adme_ops.resource_controls c),'brief',(select to_jsonb(c)from adme_brief.controls c),'billing',(select to_jsonb(c)from adme_release.billing_boundary c),'scorer',md5(pg_get_functiondef('adme_recommendation.score_v1(jsonb,jsonb)'::regprocedure)))",
  );
assert.equal(sql("select count(*)from public.creators"), "48");
assert.equal(sql("select count(*)from public.campaigns"), "8");
assert.notEqual(sql("select count(*)from adme_recommendation.snapshots"), "0");
const before = prior();
sql(readFileSync(base + "00_preflight_113.sql", "utf8"));
assert.throws(
  () => sql(apply.replace(/commit;\s*$/, () => "select 1/0;commit;")),
  /division by zero/,
);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "113",
);
assert.equal(
  sql("select to_regnamespace('adme_product_conditions')is null"),
  "t",
);
assert.equal(
  sql(
    "select count(*)from information_schema.columns where table_schema='adme_ops'and table_name='jobs'and column_name='operation'",
  ),
  "0",
);
assert.equal(
  sql(
    "select count(*)from cron.job where jobname='adme-product-conditions-cleanup'",
  ),
  "0",
);
assert.equal(prior(), before);
sql(apply);
assert.equal(
  sql("select count(*)from supabase_migrations.schema_migrations"),
  "116",
);
assert.equal(prior(), before);
assert.equal(
  sql(
    "select enabled,policy_ref is null,retention_seconds is null from adme_product_conditions.controls",
  ),
  "f|t|t",
);
assert.equal(
  sql(
    "select active from cron.job where jobname='adme-product-conditions-cleanup'",
  ),
  "t",
);
assert.equal(
  sql(
    "select has_function_privilege('authenticated','public.product_conditions_create(uuid,text,uuid)','execute'),has_function_privilege('anon','public.product_conditions_create(uuid,text,uuid)','execute'),has_function_privilege('authenticated','adme_product_conditions.valid_result(jsonb,adme_product_conditions.requests)','execute'),has_table_privilege('authenticated','adme_product_conditions.requests','select')",
  ),
  "t|f|f|f",
);
assert.throws(
  () => sql(apply),
  /STOP: product workflow already\/partially exists/,
);
for (const r of manifest.pending)
  assert.equal(
    sql(
      `select encode(sha256(convert_to(statements[1],'UTF8')),'hex')from supabase_migrations.schema_migrations where version='${r.version}'`,
    ),
    r.sha256,
  );
sql(readFileSync(base + "02_verify.sql", "utf8"));
const dir = "harness/evidence/DEV-A-PRODUCT-CONDITIONS-20261124";
mkdirSync(dir, { recursive: true });
writeFileSync(
  dir + "/packet-upgrade.json",
  JSON.stringify(
    {
      result: "PASS",
      baseline: 113,
      target: 116,
      baselineFunctions: 7,
      nonemptyLegacy: {
        creators: 48,
        campaigns: 8,
        ownedProduct: true,
        frozenV1Snapshot: true,
        profile: true,
      },
      injectedFailureRollback: true,
      namespaceColumnCronHistoryRolledBack: true,
      legacyRowsScorerAndExistingFlagsPreserved: true,
      defaultCollectionOff: true,
      ownerAndRawRoleGrants: true,
      repeatedApplyRejected: true,
      exactSourceReceipts: manifest.pending.map(({ version, sha256 }) => ({
        version,
        sha256,
      })),
      scope:
        "marked secondary local Postgres; fictional rows; no hosted/operator actions",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS113→116 atomic rollback, nonempty legacy preservation, role grants, defaultOFF, exact receipts and replay rejection",
);
