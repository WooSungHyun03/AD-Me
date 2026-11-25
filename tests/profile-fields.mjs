// D026 direct-DB checks. Local Supabase only (creates a fresh creator account).
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
const opts = { auth: { persistSession: false } };
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
assert.equal((await admin.auth.signInWithPassword(a.admin)).error, null);
const me = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
const { data: su, error: se } = await me.auth.signUp({
  email: `adme-qa-d026-${randomUUID().slice(0, 8)}@example.com`,
  password: randomUUID() + "Aa!",
  options: { data: { ...qaSignupConsent, role: "creator", name: "D026" } },
});
assert.equal(se, null);
const uid = su.user.id,
  id = `user-${uid}`;
const profile = {
  name: "D026 검증",
  bio: "",
  social_url: "",
  portfolio_url: "",
  owner_consent: false,
  categories: ["뷰티"],
  vibes: ["자연스러움"],
  formats: ["숏폼"],
  platforms: ["youtube"],
  price_min_krw: null,
  price_max_krw: null,
  is_available: null,
};
// Saves go through the versioned publication transaction, exactly like POST /api/profile
// (direct published writes are refused by the D073 publication guard).
const policy = JSON.parse(readFileSync("src/lib/policy-document.json", "utf8"));
const save = (p, published = true) =>
  me.rpc("save_publication", {
    p_scope: "creator",
    p_data: { ...profile, ...p, published },
    p_version: policy.version,
    p_hash: policy.documentHash,
    p_key: randomUUID(),
  });

assert.equal(
  (await save({})).error,
  null,
  "null quote + null availability accepted",
);
// D049/D026: a self-registered profile saved through the publication RPC is the owner's own
// (verified), so collaborations with it can be accepted.
assert.equal(
  (await me.from("creators").select("claim_status").eq("id", id).single()).data
    ?.claim_status,
  "verified",
  "self-registration through save_publication is verified",
);
assert.ok(
  (await save({ price_max_krw: 100 })).error,
  "half-unknown quote rejected",
);
assert.ok(
  (await save({ price_min_krw: 500, price_max_krw: 100 })).error,
  "max < min rejected",
);
assert.ok(
  (await save({ platforms: ["facebook"] })).error,
  "platform outside allowlist rejected",
);
assert.ok(
  (await save({ is_available: "yes" })).error,
  "non-boolean availability rejected",
);
assert.ok(
  (await me.from("creators").update({ moderation_locked: true }).eq("id", id))
    .error,
  "owner cannot set lock",
);

// Operator restriction (D059 moderation_status). The audited admin RPC needs an MFA session and is
// covered by DEV-A suites; here an owner-SQL fixture applies it so the owner-side guarantees are tested.
const ownerSql = (q) =>
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
      "-Atq",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const visible = async () =>
  (await me.rpc("creator_public_one", { p_ref: id })).data !== null;
assert.equal(
  await visible(),
  true,
  "published unknown-quote profile is public",
);
ownerSql(
  `update public.creators set moderation_status='restricted', published=false where id='${id}'`,
);
assert.equal(await visible(), false, "restricted profile hidden");
const republish = await save({}, true);
assert.equal(
  await visible(),
  false,
  `owner re-publish cannot expose a restricted profile (${republish.error?.message ?? "accepted, still hidden"})`,
);
assert.equal(
  (await save({ bio: "수정은 가능" }, false)).error,
  null,
  "owner may still edit privately",
);
assert.ok(
  (
    await me
      .from("creators")
      .update({ moderation_status: "allowed" })
      .eq("id", id)
  ).error,
  "owner cannot lift the restriction",
);
ownerSql(
  `update public.creators set moderation_status='allowed' where id='${id}'`,
);
assert.equal(
  (await save({}, true)).error,
  null,
  "re-publish allowed after operator lift",
);
assert.equal(await visible(), true, "lifted profile public again");
await me.from("creators").delete().eq("id", id);
console.log(
  "PASS: D026 profile fields — null quote/availability saved via publication RPC, half-null & range & platform & availability rejection, owner cannot set/lift moderation, restricted profile stays hidden on re-publish, operator lift restores.",
);
