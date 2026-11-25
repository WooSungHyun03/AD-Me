// D052 direct DB checks on the isolated local Supabase: one notification per source event, exact unread,
// monotonic cursor, no cross-account reads or writes, realtime delivers only own rows.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
assert.match(
  env.NEXT_PUBLIC_SUPABASE_URL,
  /^http:\/\/(127\.0\.0\.1|localhost):/,
  "local Supabase only",
);
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const login = async (acc) => {
  const db = client();
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await login(a.brand),
  other = await login(a.other);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const unread = async (db) => (await db.rpc("notification_unread")).data;
const mark = async (db, upto) =>
  (await db.rpc("mark_notifications_read", { p_upto: upto ?? null })).data;

// Fresh creator so counts start at zero.
const cdb = client();
const su = await cdb.auth.signUp({
  email: `adme-qa-d052-${randomUUID().slice(0, 8)}@example.com`,
  password: randomUUID() + "Aa!",
  options: { data: { ...qaSignupConsent, role: "creator", name: "D052" } },
});
assert.equal(su.error, null);
const cuid = su.data.user.id,
  cid = `user-${cuid}`;
// Owner SQL fixture on the disposable local DB (session_user postgres): versioned
// publication consent is covered by tests/local-publication-security.mjs.
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_AD-Me",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ],
  {
    input: `insert into public.creators(id,owner_id,published,profile) values('${cid}','${cuid}',true,'{"name":"D052 알림","bio":"","handle":"self_reported","categories":["뷰티"],"vibes":["자연스러움"],"formats":["숏폼"],"platforms":["youtube"],"price_min_krw":100000,"price_max_krw":300000,"followers":0,"is_available":true,"is_demo":false}')`,
    encoding: "utf8",
  },
);
assert.equal(await unread(cdb), 0);
assert.equal(
  await mark(cdb),
  0,
  "marking with no notifications keeps cursor at 0",
);

// Realtime: creator subscribes to own rows; "other" subscribes with a filter for the creator's id.
const got = { mine: 0, spy: 0 };
const ch1 = cdb.channel("d052-mine").on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${cuid}`,
  },
  () => got.mine++,
);
const ch2 = other.channel("d052-spy").on(
  "postgres_changes",
  {
    event: "INSERT",
    schema: "public",
    table: "notifications",
    filter: `user_id=eq.${cuid}`,
  },
  () => got.spy++,
);
await Promise.all(
  [ch1, ch2].map(
    (ch) =>
      new Promise((res) => ch.subscribe((s) => s === "SUBSCRIBED" && res())),
  ),
);

const campaign = (
  await brand
    .from("campaigns")
    .insert({
      owner_id: a.brand.id,
      status: "published",
      brief: {
        title: "D052 알림",
        product: "QA",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["youtube"],
        budget_krw: 100000,
        target_audience: "QA",
        goal: "알림 검증",
        status: "published",
      },
    })
    .select("id")
    .single()
).data.id;
// Same server path as POST /api/proposals (direct inserts are no longer the contract).
const made = await brand.rpc("create_creator_proposal", {
  p_campaign: campaign,
  p_creator: cid,
  p_kind: "proposal",
  p_brief: "D052 알림 검증용 제안입니다.",
});
assert.equal(made.error, null);
const pid = made.data;
await brand.from("messages").insert({
  proposal_id: pid,
  sender_id: a.brand.id,
  kind: "message",
  body: "첫 메시지",
});
await brand.from("messages").insert({
  proposal_id: pid,
  sender_id: a.brand.id,
  kind: "message",
  body: "두번째 메시지",
});
assert.equal(await unread(cdb), 3, "proposal + 2 messages");
// Sender is not notified of own actions.
const brandBefore = await unread(brand);
await cdb
  .from("messages")
  .insert({ proposal_id: pid, sender_id: cuid, kind: "message", body: "답장" });
assert.equal(await unread(brand), brandBefore + 1);
assert.equal(await unread(cdb), 3, "own message does not notify self");

// One notification per source: source keys are unique and match events/messages 1:1.
const rows = (
  await cdb
    .from("notifications")
    .select("id,kind,status,source_key")
    .order("id")
).data;
assert.deepEqual(
  rows.map((r) => [r.kind, r.status]),
  [
    ["status", "pending"],
    ["message", null],
    ["message", null],
  ],
);
assert.equal(new Set(rows.map((r) => r.source_key)).size, rows.length);

// Cursor: partial read, never backwards, clamped to newest own id.
assert.equal(await mark(cdb, rows[0].id), rows[0].id);
assert.equal(await unread(cdb), 2);
assert.equal(
  await mark(cdb, 1),
  rows[0].id,
  "older upto does not move cursor back",
);
const t1 = (await cdb.from("notification_cursors").select("read_at").single())
  .data.read_at;
assert.equal(
  await mark(cdb, Number.MAX_SAFE_INTEGER),
  rows[2].id,
  "clamped to newest own notification",
);
const t2 = (await cdb.from("notification_cursors").select("read_at").single())
  .data.read_at;
assert.ok(new Date(t2) >= new Date(t1), "read_at only increases");
assert.equal(await unread(cdb), 0);
// Two "tabs" racing: final cursor is the max.
await brand.from("messages").insert({
  proposal_id: pid,
  sender_id: a.brand.id,
  kind: "message",
  body: "새 메시지",
});
const latest = (
  await cdb
    .from("notifications")
    .select("id")
    .order("id", { ascending: false })
    .limit(1)
    .single()
).data.id;
const raced = await Promise.all([
  mark(cdb, latest),
  mark(cdb, rows[0].id),
  mark(cdb, latest - 1),
]);
assert.equal(Math.max(...raced), latest);
assert.equal(
  (await cdb.from("notification_cursors").select("last_read_id").single()).data
    .last_read_id,
  latest,
);

// Cross-account: cannot read, forge, delete or move someone else's notifications/cursor.
assert.equal(
  (await other.from("notifications").select("id").eq("user_id", cuid)).data
    .length,
  0,
);
assert.equal(
  (
    await other
      .from("notification_cursors")
      .select("user_id")
      .eq("user_id", cuid)
  ).data.length,
  0,
);
assert.ok(
  (
    await other.from("notifications").insert({
      user_id: cuid,
      proposal_id: pid,
      kind: "message",
      source_key: "x" + randomUUID(),
    })
  ).error,
);
assert.ok(
  (
    await cdb.from("notifications").insert({
      user_id: cuid,
      proposal_id: pid,
      kind: "message",
      source_key: "x" + randomUUID(),
    })
  ).error,
  "even self cannot forge",
);
assert.equal(
  (await cdb.from("notifications").delete().eq("user_id", cuid).select()).data
    ?.length ?? 0,
  0,
);
assert.ok(
  (
    await cdb
      .from("notification_cursors")
      .update({ last_read_id: 0 })
      .eq("user_id", cuid)
      .select()
  ).data?.length !== 1,
);
assert.equal(
  (await cdb.from("notification_cursors").select("last_read_id").single()).data
    .last_read_id,
  latest,
);
assert.ok(
  (await client().rpc("mark_notifications_read", {})).error,
  "anonymous cannot mark",
);

await sleep(1500);
assert.ok(got.mine >= 1, `realtime delivered own notifications (${got.mine})`);
assert.equal(got.spy, 0, "realtime never delivers another user's rows");
await cdb.removeAllChannels();
await other.removeAllChannels();
await brand.from("campaigns").update({ status: "closed" }).eq("id", campaign);
// Keep shared catalogs clean for later suites: the fixture creator leaves the public catalog.
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_AD-Me",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
  ],
  {
    input: `update public.creators set published=false where id='${cid}'`,
    encoding: "utf8",
  },
);
console.log(
  `PASS: D052 notifications — one per source event, sender not notified, exact unread, partial/monotonic/clamped cursor, concurrent marks keep max, cross-account read/forge/delete/cursor denied, anon denied, realtime own=${got.mine} other=0.`,
);
