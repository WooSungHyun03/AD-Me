// D026 direct-DB checks. Local Supabase only (creates a fresh creator account).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
  options: { data: { role: "creator", name: "D026" } },
});
assert.equal(se, null);
const uid = su.user.id,
  id = `user-${uid}`;
const profile = {
  name: "D026 검증",
  bio: "",
  handle: "self_reported",
  categories: ["뷰티"],
  vibes: ["자연스러움"],
  formats: ["숏폼"],
  platforms: ["youtube"],
  price_min_krw: null,
  price_max_krw: null,
  followers: 0,
  is_available: null,
  is_demo: false,
};
const save = (p, published = true) =>
  me
    .from("creators")
    .upsert(
      { id, owner_id: uid, published, profile: { ...profile, ...p } },
      { onConflict: "id" },
    );

assert.equal(
  (await save({})).error,
  null,
  "null quote + null availability accepted",
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

assert.equal(
  (
    await admin.rpc("moderate_entity", {
      p_kind: "creator",
      p_id: id,
      p_published: false,
    })
  ).error,
  null,
);
const row = async () =>
  (
    await admin
      .from("creators")
      .select("published,moderation_locked")
      .eq("id", id)
      .single()
  ).data;
assert.deepEqual(await row(), { published: false, moderation_locked: true });
assert.match(
  (await save({}, true)).error?.message ?? "",
  /locked by moderation/,
  "owner cannot re-publish locked profile",
);
assert.equal(
  (await save({ bio: "수정은 가능" }, false)).error,
  null,
  "owner may still edit privately",
);
assert.ok(
  (await me.from("creators").update({ moderation_locked: false }).eq("id", id))
    .error,
  "owner cannot lift lock",
);
assert.equal(
  (
    await admin.rpc("moderate_entity", {
      p_kind: "creator",
      p_id: id,
      p_published: true,
    })
  ).error,
  null,
);
assert.deepEqual(await row(), { published: true, moderation_locked: false });
assert.equal(
  (await save({}, true)).error,
  null,
  "re-publish allowed after admin unlock",
);
await me.from("creators").delete().eq("id", id);
console.log(
  "PASS: D026 profile fields — null quote/availability, half-null & range & platform rejection, moderation lock not liftable by owner, admin unlock.",
);
