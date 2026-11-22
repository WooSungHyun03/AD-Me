// D048 direct REST: AI usage counters are server-only; daily caps (per user, global) hold under concurrency.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const opts = { auth: { persistSession: false } };
const sql = (q) =>
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
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const as = async (acc) => {
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
  if (acc) assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await as(a.brand),
  creator = await as(a.creator),
  anon = await as();
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
sql(`delete from ai_usage`);
const reserve = (u, ul, gl) =>
  svc.rpc("reserve_ai_call", {
    p_user: u,
    p_user_limit: ul,
    p_global_limit: gl,
  });

// Clients can neither reserve nor write counters (no self-granted quota).
for (const db of [anon, brand]) {
  assert.ok(
    (
      await db.rpc("reserve_ai_call", {
        p_user: a.brand.id,
        p_user_limit: 99,
        p_global_limit: 99,
      })
    ).error,
  );
  assert.ok(
    (
      await db.rpc("record_ai_tokens", {
        p_user: a.brand.id,
        p_in: 1,
        p_out: 1,
      })
    ).error,
  );
}
assert.ok(
  (await brand.from("ai_usage").insert({ user_id: a.brand.id, calls: 0 }))
    .error,
);

// Per-user cap under 10 concurrent requests: exactly 3 granted.
const r = await Promise.all(
  Array.from({ length: 10 }, () => reserve(a.brand.id, 3, 100)),
);
assert.ok(r.every((x) => x.error === null));
assert.equal(
  r.filter((x) => x.data === true).length,
  3,
  "per-user cap holds under concurrency",
);
// Global cap: 3 used; with a global cap of 5 the creator gets 2 more even with a high per-user cap.
const g = await Promise.all(
  Array.from({ length: 6 }, () => reserve(a.creator.id, 50, 5)),
);
assert.equal(g.filter((x) => x.data === true).length, 2, "global cap holds");
assert.equal(
  (
    await svc.rpc("record_ai_tokens", {
      p_user: a.brand.id,
      p_in: 120,
      p_out: 300,
    })
  ).error,
  null,
);
await brand.from("ai_usage").update({ calls: 0 }).eq("user_id", a.brand.id);

// Read: own row only; counts only (no prompt/output columns exist).
const own = (await brand.from("ai_usage").select("*")).data;
assert.equal(own.length, 1);
assert.deepEqual(Object.keys(own[0]).sort(), [
  "calls",
  "day",
  "input_tokens",
  "output_tokens",
  "user_id",
]);
assert.equal(own[0].calls, 3, "client update had no effect");
assert.equal(own[0].output_tokens, 300);
assert.deepEqual(
  (await creator.from("ai_usage").select("user_id").eq("user_id", a.brand.id))
    .data,
  [],
);
assert.deepEqual(
  (await anon.from("ai_usage").select("user_id")).data ?? [],
  [],
);
sql(`delete from ai_usage`);
console.log(
  "PASS: D048 ai_usage — client reserve/record/write denied, per-user cap 3/10 and global cap under concurrency, tokens recorded, own-row read, counts only",
);
