// D074 direct DB checks on the isolated local Supabase: export tickets are own-only, one-time, expiring,
// re-auth gated and rate limited; hashes and logs cannot be read or forged by other accounts.
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
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
const sql = (q) =>
  execFileSync("docker", [
    "exec",
    "supabase_db_AD-Me",
    "psql",
    "-U",
    "postgres",
    "-tAc",
    q,
  ])
    .toString()
    .trim();
const fresh = async (tag) => {
  const db = client();
  const r = await db.auth.signUp({
    email: `adme-qa-d074${tag}-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role: "brand", name: "D074" } },
  });
  assert.equal(r.error, null);
  return { db, id: r.data.user.id };
};
const A = await fresh("a"),
  B = await fresh("b");
const create = (db) => db.rpc("create_privacy_export");
const consume = async (db, id, token) =>
  (await db.rpc("consume_privacy_export", { p_id: id, p_token: token })).data;

// Anonymous: no execute permission.
assert.ok((await create(client())).error, "anon cannot create");
assert.ok(
  (
    await client().rpc("consume_privacy_export", {
      p_id: randomUUID(),
      p_token: "x",
    })
  ).error,
  "anon cannot consume",
);

const t1 = (await create(A.db)).data[0];
assert.match(t1.token, /^[0-9a-f]{64}$/);
assert.ok(
  Date.parse(t1.expires_at) - Date.now() <= 15 * 60e3 + 5e3,
  "15-minute expiry",
);
// Hash never readable; raw token never stored.
assert.ok(
  (await A.db.from("privacy_exports").select("token_hash")).error,
  "token_hash column not readable",
);
assert.equal((await A.db.from("privacy_exports").select("id")).data.length, 1);
assert.equal(
  sql(`select count(*) from privacy_exports where token_hash = '${t1.token}'`),
  "0",
  "raw token not stored",
);
// Other account: cannot see, cannot use even with the correct token, cannot forge.
assert.equal(
  (await B.db.from("privacy_exports").select("id").eq("id", t1.id)).data.length,
  0,
);
assert.equal(
  await consume(B.db, t1.id, t1.token),
  "denied",
  "other account cannot download",
);
assert.ok(
  (
    await A.db.from("privacy_exports").insert({
      user_id: A.id,
      token_hash: "x",
      expires_at: new Date(Date.now() + 1e9).toISOString(),
    })
  ).error,
);
assert.ok(
  (
    await A.db
      .from("privacy_exports")
      .update({ consumed_at: null })
      .eq("id", t1.id)
  ).error,
  "no direct update",
);
assert.ok(
  (
    await A.db
      .from("privacy_access_log")
      .insert({ user_id: A.id, action: "downloaded" })
  ).error,
  "log not forgeable",
);
// Wrong token, then one-time use.
assert.equal(await consume(A.db, t1.id, "0".repeat(64)), "denied");
assert.equal(await consume(A.db, t1.id, t1.token), "ok");
assert.equal(await consume(A.db, t1.id, t1.token), "reused");
// Expiry.
const t2 = (await create(A.db)).data[0];
sql(
  `update privacy_exports set expires_at = now() - interval '1 second' where id='${t2.id}'`,
);
assert.equal(await consume(A.db, t2.id, t2.token), "expired");
// Access log: own rows only, B's attempt is in B's log without A's export id.
const logA = (
  await A.db.from("privacy_access_log").select("action,export_id").order("id")
).data.map((r) => r.action);
assert.deepEqual(logA, [
  "created",
  "denied",
  "downloaded",
  "reused",
  "created",
  "expired",
]);
assert.equal(
  (await B.db.from("privacy_access_log").select("id").eq("user_id", A.id)).data
    .length,
  0,
);
const logB = (await B.db.from("privacy_access_log").select("action,export_id"))
  .data;
assert.deepEqual(logB, [{ action: "denied", export_id: null }]);
// Rate limit: 5 tickets per 24h (A has 2).
for (let i = 0; i < 3; i++) assert.equal((await create(A.db)).error, null);
assert.match((await create(A.db)).error.message, /rate_limited/);
// Re-authentication enforced in the DB, not only in the route. Since D074 the proof is the live
// session's JWT authentication event (amr age is covered by tests/local-privacy-session.mjs); an ended
// session no longer counts even though its access token is still unexpired.
sql(`delete from auth.sessions where user_id='${B.id}'`);
assert.match((await create(B.db)).error.message, /reauth_required/);
console.log(
  "PASS: D074 privacy export — anon/other-account denied, hash unreadable, one-time, expiry, re-auth, 5/day, own-only access log",
);
