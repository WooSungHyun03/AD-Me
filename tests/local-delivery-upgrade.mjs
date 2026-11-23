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
      "-At",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "30",
);
const target = "deliverables/dev-a-deliverables-20261120",
  body = readFileSync(`${target}/01_stage_current_30.sql`, "utf8").replaceAll("\r\n", "\n"),
  source = readFileSync(
    "supabase/migrations/202611200025_deliverable_versions.sql",
    "utf8",
  ).replaceAll("\r\n", "\n");
assert.ok(body.includes(source));
const brand = randomUUID(),
  creator = randomUUID(),
  creatorId = `user-${creator}`,
  rooms = Array.from({ length: 4 }, () => randomUUID()),
  campaigns = rooms.map(() => randomUUID()),
  messages = rooms.map(() => randomUUID());
const [oldFlow, oldComplete, adopt, afterActivation] = rooms;
const json = (value) => JSON.stringify(value).replaceAll("'", "''"),
  profile = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
  brief = JSON.parse(
    rootSql("select brief::text from public.campaigns limit 1;"),
  );
const actor = (uid, statement) =>
  sql(
    `begin;set local role authenticated;set local request.jwt.claims='{"sub":"${uid}","role":"authenticated"}';${statement};commit;`,
  );
const textResult = (out) =>
  out
    .split("\n")
    .filter((x) => !["BEGIN", "SET", "COMMIT"].includes(x))
    .at(-1);
const read = (uid, id) =>
  JSON.parse(
    textResult(actor(uid, `select public.delivery_page('${id}',null,20)`)),
  );
try {
  for (const [id, role] of [
    [brand, "brand"],
    [creator, "creator"],
  ])
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${role}","name":"가상 legacy 결과물 QA"}');`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile) values('${creatorId}','${creator}',true,'${json(profile)}');`,
  );
  for (let i = 0; i < rooms.length; i++)
    sql(`insert into public.campaigns(id,owner_id,brief) values('${campaigns[i]}','${brand}','${json(brief)}');
 insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${rooms[i]}','${campaigns[i]}','${creatorId}','${brand}','${creator}','proposal','Fictional old delivery upgrade','${i === 0 ? "accepted" : i === 1 ? "completed" : "submitted"}');
 insert into public.messages(id,proposal_id,sender_id,body,kind,url) values('${messages[i]}','${rooms[i]}','${creator}','FICTIONAL original result ${i}','deliverable','https://example.test/legacy-result/${i}');`);
  const list = rooms.map((x) => `'${x}'`).join(","),
    hash = () =>
      sql(
        `select md5((select string_agg(to_jsonb(p)::text,',' order by id) from public.proposals p where id in(${list}))||(select string_agg(to_jsonb(m)::text,',' order by id) from public.messages m where proposal_id in(${list}))||(select profile::text from public.creators where id='${creatorId}'));`,
      );
  const before = hash();
  assert.equal(before.length, 32);
  assert.throws(
    () =>
      sql(
        "begin;insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');\n" +
          body,
      ),
    /STOP:/,
  );
  assert.throws(
    () =>
      sql(
        "begin;alter function public.transition_proposal(uuid,text) set search_path=pg_catalog,public;\n" +
          body,
      ),
    /STOP:/,
  );
  sql(readFileSync(`${target}/00_preflight_current_30.sql`, "utf8"));
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "31",
  );
  assert.equal(hash(), before);
  assert.equal(sql("select enabled from adme_delivery.boundary;"), "f");
  const complete = read(brand, oldComplete);
  assert.equal(complete.legacyCompleted, true);
  assert.equal(complete.active.legacy, true);
  assert.equal(complete.active.attestation, null);
  assert.deepEqual(complete.active.events, []);
  assert.equal(
    textResult(
      actor(
        creator,
        `select public.transition_proposal('${oldFlow}','submitted')`,
      ),
    ),
    "submitted",
  );
  assert.equal(
    textResult(
      actor(
        brand,
        `select public.transition_proposal('${oldFlow}','completed')`,
      ),
    ),
    "completed",
  );
  const p = read(creator, adopt);
  assert.equal(p.canAttest, true);
  actor(
    creator,
    `select public.delivery_attest('${adopt}','${messages[2]}',${p.roomRevision},'marked')`,
  );
  assert.equal(read(creator, adopt).enforced, true);
  assert.throws(
    () =>
      actor(brand, `select public.transition_proposal('${adopt}','completed')`),
    /versioned review required/,
  );
  actor(
    brand,
    `select public.delivery_transition('${adopt}','${messages[2]}',${p.roomRevision + 1},'${randomUUID()}','completed','FICTIONAL current version approval evidence',true)`,
  );
  assert.equal(read(brand, adopt).legacyCompleted, false);
  sql(
    "select adme_delivery.activate('1111111111111111111111111111111111111111');",
  );
  assert.equal(sql("select enabled from adme_delivery.boundary;"), "t");
  assert.throws(
    () =>
      actor(
        brand,
        `select public.transition_proposal('${afterActivation}','completed')`,
      ),
    /versioned review required/,
  );
  const remaining = read(creator, afterActivation);
  actor(
    creator,
    `select public.delivery_attest('${afterActivation}','${messages[3]}',${remaining.roomRevision},'not_applicable')`,
  );
  actor(
    brand,
    `select public.delivery_transition('${afterActivation}','${messages[3]}',${remaining.roomRevision + 1},'${randomUUID()}','completed','FICTIONAL explicit post activation approval',true)`,
  );
  assert.throws(
    () => sql("update adme_delivery.boundary set enabled=false;"),
    /cannot be reopened/,
  );
  assert.throws(
    () => sql("delete from adme_delivery.boundary;"),
    /cannot be reopened/,
  );
  assert.throws(() => sql(body), /STOP:/);
  assert.equal(sql("select enabled from adme_delivery.boundary;"), "t");
  for (const role of ["anon", "authenticated", "service_role"]) {
    assert.equal(
      sql(
        `select has_function_privilege('${role}','adme_delivery.activate(text)','execute');`,
      ),
      "f",
    );
    assert.equal(
      sql(
        `select count(*) from pg_class where relnamespace='adme_delivery'::regnamespace and relkind='r' and has_table_privilege('${role}',oid,'select');`,
      ),
      "0",
    );
  }
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 30,
    to_migrations: 31,
    nonempty_original_proposal_message_profile_hash_preserved: true,
    legacy_complete_not_fabricated_as_version_approval: true,
    staging_retains_old_unmanaged_app: true,
    managed_room_enforces_versions_before_global_activation: true,
    activation_closes_legacy_bypass: true,
    existing_submitted_records_can_be_adopted_without_source_edits: true,
    activation_owner_only_and_one_way: true,
    unknown_custom_hardened_and_repeat_rejected: true,
    source_sha256_lf: createHash("sha256").update(source).digest("hex"),
    scope:
      "actual generated USER SQL in exact disposable packet DB; fictional legacy records/role claims only; not hosted deployment",
  };
  writeFileSync(
    "output/dev-a-packet-db/delivery-upgrade.local.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  const list = rooms.map((x) => `'${x}'`).join(",");
  if (sql("select to_regnamespace('adme_delivery') is not null;") === "t")
    sql(`begin;alter table adme_delivery.submissions disable trigger user;alter table adme_delivery.attestations disable trigger user;alter table adme_delivery.events disable trigger user;
 update adme_delivery.rooms set active_id=null,requested_id=null where proposal_id in(${list});delete from adme_delivery.events where proposal_id in(${list});delete from adme_delivery.attestations where submission_id in(select id from adme_delivery.submissions where proposal_id in(${list}));delete from adme_delivery.submissions where proposal_id in(${list});delete from adme_delivery.rooms where proposal_id in(${list});
 alter table adme_delivery.submissions enable trigger user;alter table adme_delivery.attestations enable trigger user;alter table adme_delivery.events enable trigger user;commit;`);
  sql(
    `delete from public.audit_log where entity_id in(${list});delete from public.messages where proposal_id in(${list});delete from public.proposals where id in(${list});delete from public.campaigns where id in(${campaigns.map((x) => `'${x}'`).join(",")});delete from public.creators where id='${creatorId}';delete from adme_ops.rate_windows where subject in('${brand}','${creator}');delete from auth.users where id in('${brand}','${creator}');`,
  );
}
