// Developer-only isolated SQL proof. Never connects to a hosted environment.
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
      "-v",
      "ON_ERROR_STOP=1",
      "-Atq",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const packet = "deliverables/dev-a-p0-finish-20261121";
const body = readFileSync(`${packet}/01_apply_current_34.sql`, "utf8");
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "34",
);
const brand = randomUUID(),
  owner = randomUUID(),
  campaign = randomUUID(),
  room = randomUUID(),
  order = randomUUID(),
  id = `user-${owner}`,
  second = `packet-${randomUUID()}`;
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const profile = {
  ...JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
  name: "가상 SQL 업그레이드",
  is_demo: false,
  owner_consent: true,
  email: "PRIVATE_PACKET_CANARY",
};
const brief = JSON.parse(
  readFileSync("fixtures/campaigns.demo.json", "utf8"),
)[0];
const hash = () =>
  sql(`select md5(string_agg(v,',' order by v)) from(
 select 'creator:'||row_to_json(t)::text v from public.creators t union all select 'campaign:'||row_to_json(t)::text from public.campaigns t
 union all select 'proposal:'||row_to_json(t)::text from public.proposals t union all select 'message:'||row_to_json(t)::text from public.messages t
 union all select 'order:'||row_to_json(t)::text from public.orders t union all select 'saved:'||row_to_json(t)::text from public.saved_creators t)q;`);
try {
  sql(`insert into auth.users(id,raw_user_meta_data) values('${brand}','{"role":"brand","name":"가상 SQL 브랜드"}'),('${owner}','{"role":"creator","name":"가상 SQL 크리에이터"}');
  insert into public.creators(id,owner_id,published,profile) values('${id}','${owner}',true,'${literal(profile)}');
  insert into public.creators(id,published,profile) values('${second}',true,'${literal(profile)}');
  insert into public.campaigns(id,owner_id,brief,status) values('${campaign}','${brand}','${literal(brief)}','published');
  insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${id}','${brand}','${owner}','proposal','Fictional packet accepted room','accepted');
  insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${owner}','Fictional preserved message','message');
  insert into public.orders(id,owner_id,sku,amount) select '${order}','${brand}',sku,amount from public.products where role='brand' limit 1;
  insert into public.saved_creators(owner_id,creator_id) values('${brand}','${id}');`);
  const before = hash();
  assert.throws(() =>
    sql(
      "begin;insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      "begin;alter function public.create_test_order(text) security invoker;\n" +
        body,
    ),
  );
  assert.throws(() =>
    sql(
      body.replace(
        "-- SOURCE 202611210046",
        "select * from adme_deliberately_absent_relation;\n-- SOURCE 202611210046",
      ),
    ),
  );
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "34",
  );
  assert.equal(sql("select to_regnamespace('adme_release') is null;"), "t");
  assert.equal(hash(), before);
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "46",
  );
  assert.equal(hash(), before);
  assert.equal(sql("select enabled from adme_release.billing_boundary;"), "f");
  assert.equal(
    sql("select enabled from adme_creator.reference_boundary;"),
    "f",
  );
  assert.equal(
    sql(`set role anon;select public.creator_public_one('${id}')->>'seed_id';`),
    id,
  );
  const filters = {
    query: "",
    categories: [],
    platforms: [],
    tags: [],
    minPrice: "",
    maxPrice: "",
    minFollowers: "",
    maxFollowers: "",
    available: false,
    sort: "name",
  };
  const query = `select public.creator_filter_page('${literal(filters)}',null,1,false);`;
  const page = JSON.parse(sql("set role anon;" + query));
  assert.ok(page.nextCursor);
  const oldActivations = sql(
    "select activated_at::text||release_ref from adme_creator.read_boundary union all select activated_at::text||release_ref from adme_delivery.boundary;",
  );
  sql(readFileSync(`${packet}/03_activate_after_source_review.sql`, "utf8"));
  assert.equal(
    sql(
      "select activated_at::text||release_ref from adme_creator.read_boundary union all select activated_at::text||release_ref from adme_delivery.boundary;",
    ),
    oldActivations,
  );
  const current = JSON.parse(
    sql(`set role anon;select public.creator_public_one('${id}');`),
  );
  assert.match(current.seed_id, /^c-[a-f0-9-]{36}$/);
  assert.ok(!JSON.stringify(current).includes(owner));
  assert.ok(!JSON.stringify(current).includes("PRIVATE_PACKET_CANARY"));
  assert.throws(() =>
    sql(
      `set role anon;select public.creator_filter_page('${literal(filters)}','${page.nextCursor}',1,false);`,
    ),
  );
  assert.throws(() =>
    sql("update adme_creator.reference_boundary set enabled=false;"),
  );
  const first = sql(
    "select activated_at::text||release_ref from adme_creator.reference_boundary;",
  );
  sql(
    "select adme_creator.activate_public_refs('2222222222222222222222222222222222222222');",
  );
  assert.equal(
    sql(
      "select activated_at::text||release_ref from adme_creator.reference_boundary;",
    ),
    first,
  );
  for (const role of ["anon", "authenticated", "service_role"])
    assert.equal(
      sql(
        `select has_function_privilege('${role}','adme_creator.activate_public_refs(text)','execute');`,
      ),
      "f",
    );
  assert.equal(hash(), before);
  assert.equal(
    sql(
      "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('adme_upload','adme_release','adme_creator') and c.relkind='r' and not c.relrowsecurity;",
    ),
    "0",
  );
  assert.equal(
    sql(
      "select public::text||':'||file_size_limit from storage.buckets where id='adme-private-images';",
    ),
    "false:4194304",
  );
  assert.throws(() => sql(body));
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 34,
    to_migrations: 46,
    preserved_nonempty_profiles_campaigns_proposals_messages_orders_saved: true,
    unknown_history_and_modified_functions_rejected: true,
    mid_bundle_failure_atomic_rollback: true,
    reapply_rejected: true,
    stage_keeps_legacy_public_refs: true,
    stage_is_privacy_completion: false,
    activate_hides_auth_uid_and_private_canary: true,
    old_cursor_rejected_after_read_switch: true,
    activation_owner_only_one_way_and_first_evidence_preserved: true,
    private_storage_four_mib_and_all_new_private_tables_rls: true,
    scope:
      "Actual generated SQL, fictional records in marked loopback packet DB. No hosted configuration/deployment/provider verification.",
  };
  writeFileSync(
    "harness/evidence/DEV-A-P0-FINISH-20261121/packet-upgrade.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.saved_creators where owner_id='${brand}';delete from public.orders where id='${order}';delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';delete from public.creators where id in('${id}','${second}');delete from auth.users where id in('${brand}','${owner}');`,
  );
}
