// D036 direct REST checks on the isolated local Supabase: group CRUD, uniqueness, campaign ownership, default list.
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
const login = async (acc) => {
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await login(a.brand),
  other = await login(a.other);
const err = (r) => r.error?.message ?? "";
const tag = randomUUID().slice(0, 6);

// Default list: idempotent, one per owner, not deletable, scope fixed.
const d1 = (await brand.rpc("ensure_default_list")).data,
  d2 = (await brand.rpc("ensure_default_list")).data;
assert.ok(d1 && d1 === d2);
assert.ok(
  (
    await brand
      .from("saved_lists")
      .insert({ owner_id: a.brand.id, name: `기본2 ${tag}`, is_default: true })
  ).error,
  "second default list rejected",
);
assert.match(
  err(await brand.from("saved_lists").delete().eq("id", d1)),
  /default_list_locked/,
);
assert.match(
  err(
    await brand.from("saved_lists").update({ is_default: false }).eq("id", d1),
  ),
  /list_scope_locked/,
);

// Group CRUD + unique name per owner.
const g = (
  await brand
    .from("saved_lists")
    .insert({ owner_id: a.brand.id, name: `여름 ${tag}` })
    .select("id")
    .single()
).data.id;
assert.match(
  err(
    await brand
      .from("saved_lists")
      .insert({ owner_id: a.brand.id, name: `여름 ${tag}` }),
  ),
  /duplicate key/,
);
assert.equal(
  (
    await brand
      .from("saved_lists")
      .update({ name: `가을 ${tag}` })
      .eq("id", g)
  ).error,
  null,
);
assert.equal(
  (
    await brand
      .from("saved_list_items")
      .insert({ list_id: g, creator_id: "creator-001", owner_id: a.brand.id })
  ).error,
  null,
);
assert.match(
  err(
    await brand
      .from("saved_list_items")
      .insert({ list_id: g, creator_id: "creator-001", owner_id: a.brand.id }),
  ),
  /duplicate key/,
  "no duplicate member",
);

// Other user: cannot see, rename, delete, or add to the group, nor spoof owner_id.
assert.equal(
  (await other.from("saved_lists").select("id").eq("id", g)).data.length,
  0,
);
assert.equal(
  (await other.from("saved_list_items").select("creator_id").eq("list_id", g))
    .data.length,
  0,
);
assert.equal(
  (
    await other
      .from("saved_lists")
      .update({ name: "탈취" })
      .eq("id", g)
      .select()
  ).data.length,
  0,
);
assert.equal(
  (await other.from("saved_lists").delete().eq("id", g).select()).data.length,
  0,
);
assert.ok(
  (
    await other
      .from("saved_list_items")
      .insert({ list_id: g, creator_id: "creator-002", owner_id: a.other.id })
  ).error,
  "add to someone else's list",
);
assert.ok(
  (
    await other
      .from("saved_list_items")
      .insert({ list_id: g, creator_id: "creator-002", owner_id: a.brand.id })
  ).error,
  "spoofed owner_id",
);

// Campaign shortlist: only on own campaign, one per campaign, campaign link immutable.
const brief = {
  title: "D036 후보",
  product: "QA",
  category: "뷰티",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["youtube"],
  budget_krw: 100000,
  target_audience: "QA 고객",
  goal: "후보 검증",
  status: "draft",
};
const camp = (
  await brand
    .from("campaigns")
    .insert({ owner_id: a.brand.id, brief, status: "draft" })
    .select("id")
    .single()
).data.id;
assert.match(
  err(
    await other
      .from("saved_lists")
      .insert({
        owner_id: a.other.id,
        name: `훔친 후보 ${tag}`,
        campaign_id: camp,
      }),
  ),
  /row-level security/,
  "other brand cannot link my campaign",
);
const s = await brand
  .from("saved_lists")
  .insert({
    owner_id: a.brand.id,
    name: `캠페인 후보 ${tag}`,
    campaign_id: camp,
  })
  .select("id")
  .single();
assert.equal(s.error, null);
assert.match(
  err(
    await brand
      .from("saved_lists")
      .insert({
        owner_id: a.brand.id,
        name: `캠페인 후보2 ${tag}`,
        campaign_id: camp,
      }),
  ),
  /duplicate key/,
  "one shortlist per campaign",
);
const otherList = (
  await other
    .from("saved_lists")
    .insert({ owner_id: a.other.id, name: `내 그룹 ${tag}` })
    .select("id")
    .single()
).data.id;
assert.ok(
  (
    await other
      .from("saved_lists")
      .update({ campaign_id: camp })
      .eq("id", otherList)
  ).error,
  "cannot re-point own list at another's campaign",
);
assert.match(
  err(
    await brand
      .from("saved_lists")
      .update({ campaign_id: null })
      .eq("id", s.data.id),
  ),
  /list_scope_locked/,
);

// Group delete cascades items; campaign delete cascades its shortlist.
assert.equal(
  (await brand.from("saved_lists").delete().eq("id", g)).error,
  null,
);
assert.equal(
  (await brand.from("saved_list_items").select("creator_id").eq("list_id", g))
    .data.length,
  0,
);
assert.equal(
  (await brand.from("campaigns").delete().eq("id", camp)).error,
  null,
);
assert.equal(
  (await brand.from("saved_lists").select("id").eq("id", s.data.id)).data
    .length,
  0,
);
await other.from("saved_lists").delete().eq("id", otherList);
console.log(
  "PASS: D036 lists — default list idempotent/locked, group CRUD, unique name & member, other user denied (read/update/delete/insert/spoof), shortlist only on own campaign, one per campaign, link immutable, cascades.",
);
