// Exact disposable packet DB only. This never accepts a hosted target or project ID.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
const body = readFileSync("deliverables/dev-a-messages-20261120.sql", "utf8");
const source = readFileSync(
  "supabase/migrations/202611200018_conversations.sql",
  "utf8",
).replaceAll("\r\n", "\n");
assert.ok(body.replaceAll("\r\n", "\n").includes(source));
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "23",
);
const brand = randomUUID(),
  creator = randomUUID(),
  campaign = randomUUID(),
  room = randomUUID(),
  id = `user-${creator}`;
const jsonSql = (value) => JSON.stringify(value).replaceAll("'", "''");
const profile = JSON.parse(
  readFileSync("fixtures/creators.demo.json", "utf8"),
)[0];
const brief = JSON.parse(
  rootSql("select brief::text from public.campaigns limit 1;"),
);
try {
  for (const [role, uid] of [
    ["brand", brand],
    ["creator", creator],
  ])
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${uid}','{"role":"${role}","name":"가상 upgrade QA"}');`,
    );
  sql(`insert into public.creators(id,owner_id,published,profile) values('${id}','${creator}',true,'${jsonSql(profile)}');
    insert into public.campaigns(id,owner_id,brief) values('${campaign}','${brand}','${jsonSql(brief)}');
    insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${id}','${brand}','${creator}','proposal','Fictional migration compatibility','accepted');
    insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${brand}','FICTIONAL old message','message');`);
  const hash = () =>
    sql(
      `select md5(string_agg((to_jsonb(m)-'idempotency_key')::text,',' order by id)) from public.messages m where proposal_id='${room}';`,
    );
  const before = hash(),
    boundary = sql("select enabled from adme_creator.read_boundary;");
  assert.throws(() =>
    sql(
      "begin; insert into supabase_migrations.schema_migrations(version,name) values('209901010001','unknown');\n" +
        body,
    ),
  );
  sql(body);
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "24",
  );
  assert.equal(hash(), before);
  assert.equal(
    sql("select enabled from adme_creator.read_boundary;"),
    boundary,
  );
  const oldInsert = sql(`begin; set local role authenticated;
    set local request.jwt.claims='{"sub":"${brand}","role":"authenticated"}';
    insert into public.messages(proposal_id,sender_id,body,kind) values('${room}','${brand}','FICTIONAL legacy insert after upgrade','message');
    select count(*) from public.messages where proposal_id='${room}'; rollback;`);
  assert.match(oldInsert, /\b2\b/);
  assert.throws(() => sql(body));
  assert.equal(hash(), before);
  const result = {
    at: new Date().toISOString(),
    result: "PASS",
    from_migrations: 23,
    to_migrations: 24,
    existing_message_hash_preserved: true,
    legacy_insert_and_RLS_compatible: true,
    read_boundary_unchanged: true,
    unknown_history_and_repeat_rejected: true,
    source_sha256_lf: createHash("sha256")
      .update(source.replaceAll("\r\n", "\n"))
      .digest("hex"),
    scope:
      "actual generated USER SQL in exact isolated packet DB; fictional records only; no hosted writes",
  };
  writeFileSync(
    "output/dev-a-packet-db/conversation-upgrade.local.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
} finally {
  sql(
    `delete from public.messages where proposal_id='${room}'; delete from public.proposals where id='${room}'; delete from public.campaigns where id='${campaign}'; delete from public.creators where id='${id}'; delete from auth.users where id in ('${brand}','${creator}');`,
  );
}
