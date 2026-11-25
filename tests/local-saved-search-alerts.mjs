// D037: opt-in in-app new-candidate alerts on the actual local stack (Auth/PostgREST/Postgres, fictional data).
// The cron job body (adme_search.scan_alerts) is invoked directly instead of waiting 15 minutes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { localClient, localRuntime, sql } from "./support/local-qa.mjs";
localRuntime();
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const owner = localClient(),
  other = localClient(),
  anon = localClient();
for (const [client, account] of [
  [owner, accounts.brand],
  [other, accounts.other],
])
  assert.equal((await client.auth.signInWithPassword(account)).error, null);
const marker = `가상D037${randomUUID().slice(0, 6)}`,
  marker2 = `${marker}변경`;
const filters = (query) => ({
  query,
  categories: [],
  platforms: [],
  tags: [],
  minPrice: "",
  maxPrice: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  available: false,
  sort: "name",
});
const id = randomUUID(),
  creators = [];
// Fictional owned, published creator whose name carries the search marker.
function publish(name) {
  const user = randomUUID();
  creators.push(user);
  sql(`insert into auth.users(id,raw_user_meta_data,confirmation_token,recovery_token,email_change,email_change_token_new)
    values('${user}','{"role":"creator","name":"${name}"}','','','','');
    insert into public.creators(id,owner_id,published,profile) select 'user-${user}','${user}',true,
    profile||jsonb_build_object('name','${name}','is_demo',false,'owner_consent',true) from public.creators where id='creator-001';`);
  return `user-${user}`;
}
const scan = () => Number(sql("select adme_search.scan_alerts();"));
const alerts = () =>
  sql(
    `select coalesce(string_agg(new_count::text,',' order by id),'') from public.notifications where saved_search_id='${id}';`,
  );
const revision = async () =>
  (await owner.rpc("saved_search_list")).data.find((x) => x.id === id).revision;
const toggle = (client, expected, notify) =>
  client.rpc("saved_search_alerts", {
    p_id: id,
    p_expected: expected,
    p_notify: notify,
  });
let groups = 0;
try {
  assert.equal(
    (
      await owner.rpc("saved_search_put", {
        p_id: id,
        p_expected: 0,
        p_name: "가상 알림 검색",
        p_filters: filters(marker),
      })
    ).error,
    null,
  );
  publish(`${marker} 기존`);
  // 1. Opt-in is owner-only, revisioned and absent from anonymous/role-free paths.
  assert.equal((await toggle(other, 1, true)).error.code, "P0002");
  assert.ok((await toggle(anon, 1, true)).error);
  assert.equal((await toggle(owner, 9, true)).error.code, "40001");
  assert.equal(
    sql(
      "select has_function_privilege('authenticated','adme_search.scan_alerts()','execute'),has_function_privilege('anon','public.saved_search_alerts(uuid,integer,boolean)','execute'),has_table_privilege('authenticated','adme_search.seen_candidates','select');",
    ),
    "f|f|f",
  );
  assert.equal(
    (await owner.rpc("adme_search.scan_alerts")).error !== null,
    true,
  );
  const race = await Promise.all([
    toggle(owner, 1, true),
    toggle(owner, 1, true),
  ]);
  assert.equal(race.filter((x) => !x.error).length, 1);
  assert.equal(race.find((x) => x.error).error.code, "40001");
  assert.equal(
    (await owner.rpc("saved_search_list")).data.find((x) => x.id === id).notify,
    true,
  );
  groups++;
  // 2. Opting in baselines silently: the creator that already matched is not announced.
  assert.equal(scan(), 0);
  assert.equal(alerts(), "");
  groups++;
  // 3. A newly published match produces exactly one in-app alert, visible only to the owner, with no email.
  publish(`${marker} 신규`);
  assert.equal(scan(), 1);
  assert.equal(alerts(), "1");
  const mine = await owner
    .from("notifications")
    .select("kind,new_count,proposal_id")
    .eq("kind", "saved_search");
  assert.deepEqual(mine.data, [
    { kind: "saved_search", new_count: 1, proposal_id: null },
  ]);
  assert.equal(
    (await other.from("notifications").select("id").eq("kind", "saved_search"))
      .data.length,
    0,
  );
  assert.ok((await owner.rpc("notification_unread")).data >= 1);
  assert.equal(
    sql(
      `select count(*) from public.email_outbox where source_key in(select 'notification:'||id from public.notifications where saved_search_id='${id}');`,
    ),
    "0",
  );
  groups++;
  // 4. The same candidates never alert twice, even after their profile is updated.
  sql(
    `update public.creators set profile=profile||'{"bio":"가상 갱신"}' where id in(${creators.map((u) => `'user-${u}'`).join(",")});`,
  );
  assert.equal(scan(), 0);
  assert.equal(alerts(), "1");
  groups++;
  // 5. A condition change re-baselines silently; only later matches alert.
  publish(`${marker2} 변경 전부터`);
  assert.equal(
    (
      await owner.rpc("saved_search_put", {
        p_id: id,
        p_expected: await revision(),
        p_name: "가상 알림 검색",
        p_filters: filters(marker2),
      })
    ).error,
    null,
  );
  assert.equal(scan(), 0);
  publish(`${marker2} 변경 후`);
  assert.equal(scan(), 1);
  assert.equal(alerts(), "1,1");
  groups++;
  // 6. A concurrent run holding the job lock does not double-process.
  publish(`${marker2} 동시`);
  const holder = spawn("docker", [
    "exec",
    "-i",
    localRuntime().DB_CONTAINER ?? "supabase_db_dev-a-db",
    "psql",
    "-U",
    "postgres",
    "-c",
    "begin; select pg_advisory_xact_lock(hashtext('adme-saved-search-alerts')); select pg_sleep(3); commit;",
  ]);
  await new Promise((r) => setTimeout(r, 1000));
  assert.equal(scan(), 0);
  await new Promise((r) => holder.on("exit", r));
  assert.equal(scan(), 1);
  assert.equal(alerts(), "1,1,1");
  groups++;
  // 7. Turning alerts off stops new alerts.
  assert.equal((await toggle(owner, await revision(), false)).error, null);
  publish(`${marker2} 해지 후`);
  assert.equal(scan(), 0);
  assert.equal(alerts(), "1,1,1");
  groups++;
  // 8. Deleting the saved search removes its alerts and seen set.
  assert.equal(
    (
      await owner.rpc("saved_search_delete", {
        p_id: id,
        p_expected: await revision(),
      })
    ).error,
    null,
  );
  assert.equal(
    sql(
      `select (select count(*) from public.notifications where saved_search_id='${id}')+(select count(*) from adme_search.seen_candidates where condition_id='${id}');`,
    ),
    "0",
  );
  groups++;
  console.log(`PASS saved-search alerts ${groups} groups`);
} finally {
  sql(`delete from adme_search.saved_conditions where id='${id}';
    delete from public.creators where id in(${creators.map((u) => `'user-${u}'`).join(",") || "''"});
    delete from auth.users where id in(${creators.map((u) => `'${u}'`).join(",") || "null"});
    delete from adme_ops.rate_windows where scope in('saved_search_write','saved_search_read','creator_catalog') and subject in('${accounts.brand.id}','${accounts.other.id}');`);
}
