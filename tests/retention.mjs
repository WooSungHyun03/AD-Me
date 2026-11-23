// D079 direct DB checks on the isolated local Supabase: tombstones are written by every deletion path, hold no
// content, survive a (simulated) backup restore through the off-DB ledger and are re-applied idempotently;
// the retention job removes only expired rows and records its runs; users cannot reach any of it.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
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
const opts = { auth: { persistSession: false } };
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const psql = (q) =>
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      q,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
const psqlErr = (q) => {
  try {
    psql(q);
    return "";
  } catch (e) {
    return String(e.stderr);
  }
};
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const admin = client();
assert.equal((await admin.auth.signInWithPassword(a.admin)).error, null);
const signup = async (role) => {
  const db = client();
  const r = await db.auth.signUp({
    email: `adme-qa-d079-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role, name: "D079" } },
  });
  assert.equal(r.error, null);
  return { db, uid: r.data.user.id };
};
const C = await signup("creator"),
  B = await signup("brand");

// 1. Users cannot reach tombstones, the ledger, the reapply or the retention job.
for (const db of [client(), C.db, admin]) {
  assert.ok((await db.rpc("tombstone_ledger")).error, "ledger is server-only");
  assert.ok(
    (await db.rpc("reapply_tombstones", { p_ledger: [] })).error,
    "reapply is server-only",
  );
  assert.ok(
    (await db.rpc("run_retention")).error,
    "retention job is server-only",
  );
}
assert.ok(
  (
    await C.db
      .from("deletion_tombstones")
      .insert({ subject_kind: "upload", subject_id: "x" })
  ).error,
);
assert.equal(
  (await C.db.from("deletion_tombstones").select("id")).data.length,
  0,
  "tombstones admin-only",
);
assert.ok((await C.db.from("retention_runs").insert({ status: "ok" })).error);

// 2. Three deletions through their real paths.
// a) collected profile: deletion request resolved by an admin.
const cid = `qa-collected-${randomUUID().slice(0, 8)}`,
  handle = `qa_d079_${randomUUID().slice(0, 6)}`;
const collected = JSON.stringify({
  name: "D079 수집 프로필",
  bio: "원문 소개",
  handle,
  categories: ["뷰티"],
  vibes: [],
  formats: [],
  platforms: ["youtube"],
  price_min_krw: null,
  price_max_krw: null,
  followers: 0,
  is_available: null,
  is_demo: false,
  social_url: `https://example.com/${handle}/`,
});
psql(
  `insert into creators(id, owner_id, published, profile) values ('${cid}', null, true, '${collected}'::jsonb)`,
);
const req = await B.db.rpc("submit_report", {
  p_kind: "deletion",
  p_creator: cid,
  p_reason: "본인 동의 없이 수집된 프로필이라 삭제를 요청합니다.",
  p_source_url: null,
  p_parent: null,
});
assert.equal(req.error, null);
assert.equal(
  (
    await admin.rpc("review_report", {
      p_id: req.data[0].id,
      p_status: "resolved",
      p_response: "삭제했습니다.",
      p_hide: null,
    })
  ).error,
  null,
);
// b) owner profile: the creator removes it (same update the DELETE route performs).
const oid = `user-${C.uid}`;
const own = {
  name: "D079 본인",
  bio: "본인 소개 원문",
  handle: "self_reported",
  categories: ["뷰티"],
  vibes: [],
  formats: [],
  platforms: ["youtube"],
  price_min_krw: null,
  price_max_krw: null,
  followers: 0,
  is_available: null,
  is_demo: false,
};
assert.equal(
  (
    await C.db
      .from("creators")
      .upsert({ id: oid, owner_id: C.uid, published: true, profile: own })
  ).error,
  null,
);
const ownerBefore = psql(
  `select profile::text from creators where id='${oid}'`,
);
const removed = {
  ...own,
  name: "삭제된 크리에이터",
  bio: "",
  data_source: "owner_removed",
  owner_id: C.uid,
};
assert.equal(
  (
    await C.db
      .from("creators")
      .update({ published: false, profile: removed })
      .eq("owner_id", C.uid)
  ).error,
  null,
);
// c) upload: the owner deletes it.
const upId = randomUUID();
assert.equal(
  (
    await service.from("uploads").insert({
      id: upId,
      owner_id: C.uid,
      path: `${C.uid}/${upId}.png`,
      mime: "image/png",
      size_bytes: 11,
      original_name: "a.png",
      rights_confirmed: true,
    })
  ).error,
  null,
);
assert.equal((await C.db.rpc("delete_upload", { p_id: upId })).error, null);

// 3. Tombstones exist, carry only ids + hashes; the request evidence is not linked; suppression keys are hashed.
const tomb =
  psql(`select string_agg(subject_kind || '|' || array_to_string(key_hashes, ';'), ',' order by subject_kind)
  from deletion_tombstones where subject_id in ('${cid}','${oid}','${upId}')`);
assert.match(
  tomb,
  /^collected_profile\|h:[0-9a-f]{64}(;h:[0-9a-f]{64})+,owner_profile\|,upload\|$/,
);
assert.ok(
  !tomb.includes(handle) && !tomb.includes("example.com"),
  "no raw handle/url in tombstones",
);
assert.equal(
  psql(
    `select count(*) from information_schema.columns where table_name='deletion_tombstones' and column_name like '%report%'`,
  ),
  "0",
);
assert.equal(
  psql(
    `select count(*) from suppressed_sources where match_key not like 'h:%'`,
  ),
  "0",
  "suppression stores hashes only",
);
assert.equal(
  psql(
    `select count(*) from deletion_tombstones t, creators c where t.subject_id = c.id and c.profile::text like '%원문%'`,
  ),
  "0",
);

// 4. Off-DB ledger copy (as the server does after each deletion).
const { data: ledger, error: le } = await service.rpc("tombstone_ledger");
assert.equal(le, null);
assert.ok(
  ledger.some((t) => t.subject_id === cid) &&
    ledger.every((t) => Object.keys(t).length === 4),
);

// 5. Simulated restore of a backup taken before the deletions: content, suppression and tombstones all come back old.
// (a real restore swaps all tables at once; here the suppression/tombstone rows go first so the old content can be written back)
psql(
  `delete from suppressed_sources where report_id = '${req.data[0].id}' or report_id is null`,
);
psql(
  `delete from deletion_tombstones where subject_id in ('${cid}','${oid}','${upId}')`,
);
psql(
  `update creators set published = true, moderation_locked = false, profile = '${collected}'::jsonb where id = '${cid}'`,
);
psql(
  `update creators set published = true, profile = '${ownerBefore.replace(/'/g, "''")}'::jsonb where id = '${oid}'`,
);
psql(
  `update uploads set status = 'ready', deleted_at = null where id = '${upId}'`,
);
assert.equal(
  (await client().from("creators").select("id").eq("id", cid)).data.length,
  1,
  "restore re-exposed the profile",
);

// 6. Re-apply from the ledger: all three deletions return; a retry changes nothing.
const r1 = await service.rpc("reapply_tombstones", { p_ledger: ledger });
assert.equal(r1.error, null);
assert.ok(
  r1.data.merged >= 3 &&
    r1.data.collected_profiles >= 1 &&
    r1.data.owner_profiles >= 1 &&
    r1.data.uploads >= 1,
  JSON.stringify(r1.data),
);
assert.equal(
  (await client().from("creators").select("id").eq("id", cid)).data.length,
  0,
  "collected profile hidden again",
);
assert.equal(
  psql(`select profile->>'name' from creators where id='${cid}'`),
  "삭제된 프로필",
);
assert.equal(
  psql(
    `select profile->>'data_source' || ',' || published from creators where id='${oid}'`,
  ),
  "owner_removed,false",
);
assert.equal(psql(`select status from uploads where id='${upId}'`), "deleted");
assert.match(
  psqlErr(
    `insert into creators(id, owner_id, published, profile) values ('${cid}-again', null, true, '${collected}'::jsonb)`,
  ),
  /suppressed_source/,
  "re-collection blocked again",
);
const r2 = await service.rpc("reapply_tombstones", { p_ledger: ledger });
assert.deepEqual(
  r2.data,
  {
    merged: 0,
    suppressed_keys: 0,
    collected_profiles: 0,
    owner_profiles: 0,
    uploads: 0,
  },
  "retry is a no-op",
);

// 7. Owner re-registers: their new choice drops the owner tombstone, so a later reapply leaves it alone.
assert.equal(
  (
    await C.db
      .from("creators")
      .update({ published: true, profile: { ...own, name: "D079 재등록" } })
      .eq("id", oid)
  ).error,
  null,
);
assert.equal(
  psql(`select count(*) from deletion_tombstones where subject_id='${oid}'`),
  "0",
);
const ledger2 = (await service.rpc("tombstone_ledger")).data;
assert.equal(
  (await service.rpc("reapply_tombstones", { p_ledger: ledger2 })).data
    .owner_profiles,
  0,
);
assert.equal(
  psql(`select profile->>'name' from creators where id='${oid}'`),
  "D079 재등록",
);
// A forged ledger entry with content is refused by the column check.
assert.ok(
  (
    await service.rpc("reapply_tombstones", {
      p_ledger: [
        {
          subject_kind: "collected_profile",
          subject_id: "x",
          key_hashes: ["url:https://raw"],
        },
      ],
    })
  ).error,
);

// 8. Retention: expired rows go, recent rows stay, the run is recorded.
const camp = psql(`select id from campaigns limit 1`);
const pid =
  psql(`insert into proposals(campaign_id, creator_id, creator_user_id, brand_id, kind, status, brief, created_at, updated_at)
  values ('${camp}', '${oid}', '${C.uid}', '${B.uid}', 'proposal', 'completed', '오래된 협업 제안 원문입니다.', now() - interval '4 years', now() - interval '4 years') returning id`).split(
    "\n",
  )[0];
psql(
  `insert into messages(proposal_id, sender_id, kind, body, created_at) values ('${pid}', '${B.uid}', 'message', '오래된 메시지', now() - interval '4 years')`,
);
psql(
  `update proposals set updated_at = now() - interval '4 years' where id = '${pid}'`,
);
psql(`insert into notifications(user_id, proposal_id, kind, status, source_key, created_at) values
  ('${B.uid}', '${pid}', 'status', 'read', 'd079-old-${pid}', now() - interval '200 days'),
  ('${B.uid}', '${pid}', 'status', 'read', 'd079-new-${pid}', now())`);
psql(
  `insert into audit_log(actor_id, entity_id, action, created_at) values ('${B.uid}', 'd079', 'old', now() - interval '2 years'), ('${B.uid}', 'd079', 'new', now())`,
);
const run = await service.rpc("run_retention");
assert.equal(run.error, null);
assert.ok(
  run.data.messages >= 1 &&
    run.data.proposal_briefs >= 1 &&
    run.data.notifications >= 1 &&
    run.data.audit_log >= 1,
  JSON.stringify(run.data),
);
assert.equal(
  psql(`select count(*) from messages where proposal_id='${pid}'`),
  "0",
);
assert.equal(
  psql(`select brief from proposals where id='${pid}'`),
  "[보존기간 경과로 삭제됨]",
);
assert.equal(
  psql(
    `select string_agg(source_key, ',') from notifications where source_key like 'd079-%-${pid}'`,
  ),
  `d079-new-${pid}`,
);
assert.equal(
  psql(`select string_agg(action, ',') from audit_log where entity_id='d079'`),
  "new",
);
assert.match(
  psql(
    `select status || ',' || (counts ? 'messages')::text from retention_runs order by id desc limit 1`,
  ),
  /^ok,true$/,
);
assert.equal(
  (await service.rpc("run_retention")).data.messages,
  0,
  "second run has nothing left to remove",
);
console.log(
  "PASS: D079 retention — tombstones on 3 deletion paths (ids+hashes only), ledger reapply after simulated restore, idempotent retry, owner re-register kept, retention job + run log, user access denied",
);
