// D086 direct REST: ops_stats (sizes/counts) is admin/service only.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { elevateAdmin } from "./support/admin-mfa.mjs";
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
const as = async (acc) => {
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
  if (acc) assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
assert.ok((await (await as()).rpc("ops_stats")).error, "anon denied");
assert.match(
  (await (await as(a.brand)).rpc("ops_stats")).error.message,
  /forbidden/,
);
assert.match(
  (await (await as(a.creator)).rpc("ops_stats")).error.message,
  /forbidden/,
);
const { data, error } = await (await elevateAdmin(await as(a.admin), a.admin)).rpc("ops_stats");
assert.equal(error, null);
assert.ok(data.db_bytes > 0 && /^(\d{12}|\d{14})$/.test(data.migration));
assert.ok(!JSON.stringify(data).includes("@"), "no emails in stats");
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
assert.equal((await svc.rpc("ops_stats")).error, null);
console.log(
  "PASS: D086 ops_stats — anon/brand/creator denied, admin+service allowed, counts/sizes only",
);
