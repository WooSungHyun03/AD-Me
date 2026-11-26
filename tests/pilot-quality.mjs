// D024 direct REST checks on the isolated local Supabase: the pilot quality facts are service-role only,
// expose opaque refs (no raw channel ids or titles), detect duplicate titles and report a stored row
// whose source was deleted (tombstoned). Fixture rows use a disabled, non-isolated QA policy and are removed.
import { lit, ownerSql } from "./support/owner-sql.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [
      l.slice(0, l.indexOf("=")),
      l.slice(l.indexOf("=") + 1).trim(),
    ]),
);
assert.match(
  env.NEXT_PUBLIC_SUPABASE_URL,
  /^http:\/\/(127\.0\.0\.1|localhost):/,
  "local Supabase only",
);
const make = (key) =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
let passed = 0;
const ok = (name) => {
  passed += 1;
  console.log(`PASS ${name}`);
};

// Browser roles (anon, signed-in brand, password-only admin) cannot read the facts.
for (const [name, db] of [
  ["anon", make(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
  ["brand", make(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
  ["admin", make(env.NEXT_PUBLIC_SUPABASE_ANON_KEY)],
]) {
  if (name !== "anon")
    assert.equal((await db.auth.signInWithPassword(a[name])).error, null);
  const { data, error } = await db.rpc("pilot_quality_samples");
  assert.equal(data, null, `${name} must not read pilot facts`);
  assert.ok(error, `${name} must be refused`);
}
ok("browser roles are refused");

const policy = `qa-d024-${Date.now()}`;
const ids = [
  "UCd024QAaaaaaaaaaaaaaaaa",
  "UCd024QAbbbbbbbbbbbbbbbb",
  "UCd024QAcccccccccccccccc",
];
const title = `D024 중복 제목 ${Date.now()}`;
try {
  // Owner SQL with triggers off (replica role) stores rows the cache guard would normally rewrite or refuse,
  // simulating legacy/broken rows the gate must still catch. Local disposable DB only.
  ownerSql(`
    set session_replication_role = replica;
    insert into adme_ops.source_runtime_policies(version,provider,enabled,cache_seconds,job_seconds,tombstone_seconds,daily_units,max_attempts,review_ref)
      values(${lit(policy)},'youtube',false,3600,3600,3600,1,1,'QA D024 non-isolated disabled policy');
    insert into adme_ops.channels(channel_id,title,subscriber_count,videos,source_policy,expires_at,metadata) values
      (${lit(ids[0])},${lit(title)},1000,'[{"id":"v"}]',${lit(policy)},now()+interval '1 day','{"views":1}'),
      (${lit(ids[1])},${lit(title)},null,'[]',${lit(policy)},now()+interval '1 day','{}'),
      (${lit(ids[2])},${lit("D024 삭제 대상")},5,'[{"id":"v"}]',${lit(policy)},now()+interval '1 day','{"views":1}');
    insert into adme_ops.source_tombstones(resource_hash,policy_version,request_ref,expires_at)
      values(adme_ops.resource_hash(${lit(ids[2])}),${lit(policy)},gen_random_uuid(),now()+interval '1 hour');
    set session_replication_role = origin;
  `);
  const svc = make(env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await svc.rpc("pilot_quality_samples");
  assert.equal(error, null);
  const raw = JSON.stringify(data);
  for (const id of ids) assert.ok(!raw.includes(id), "raw channel id leaked");
  assert.ok(!raw.includes(title), "raw title leaked");
  ok("service role reads facts without raw ids or titles");

  const mine = data.samples.filter((s) => s.policy === policy);
  assert.equal(mine.length, 3);
  for (const s of mine) {
    assert.match(s.ref, /^[0-9a-f]{12}$/);
    assert.equal(s.policyIsolated, false);
    assert.equal(s.policyEnabled, false);
    assert.equal(s.ownerVerified, false);
  }
  const hashes = mine.map((s) => s.titleHash);
  assert.equal(
    hashes.filter((h) => h === hashes[0]).length,
    2,
    "same titles share one hash",
  );
  ok("duplicate titles share a hash; disabled non-isolated policy reported");

  const sparse = mine.find((s) => s.subscriberCount === null);
  assert.deepEqual([sparse.videoCount, sparse.hasViews], [0, false]);
  assert.equal(mine.filter((s) => s.tombstoned).length, 1);
  assert.ok(data.activeTombstones >= 1);
  ok("missing fields and deleted-but-stored rows are visible to the gate");
} finally {
  ownerSql(`
    delete from adme_ops.source_tombstones where policy_version=${lit(policy)};
    delete from adme_ops.channels where source_policy=${lit(policy)};
    delete from adme_ops.source_runtime_policies where version=${lit(policy)};
  `);
}
console.log(`pilot-quality: ${passed}/4 PASS`);
