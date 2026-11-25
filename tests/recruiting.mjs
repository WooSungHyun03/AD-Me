// D043 direct DB checks on the isolated local Supabase: deadline, capacity race, transitions, other-brand access.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { publishCreator } from "./support/creator-publication.mjs";
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
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const login = async (acc) => {
  const db = client();
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await login(a.brand),
  other = await login(a.other);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newCreator(tag) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `adme-qa-d043-${tag}-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role: "creator", name: "D043" } },
  });
  assert.equal(error, null);
  const uid = data.user.id,
    id = `user-${uid}`;
  const profile = {
    name: `D043 ${tag}`,
    bio: "",
    handle: "self_reported",
    categories: ["뷰티"],
    vibes: ["자연스러움"],
    formats: ["숏폼"],
    platforms: ["youtube"],
    price_min_krw: null,
    price_max_krw: null,
    followers: 0,
    is_available: true,
    is_demo: false,
  };
  assert.equal(
    (
      await publishCreator(db, profile)
    ).error,
    null,
  );
  return { db, uid, id };
}
const brief = {
  title: "D043 모집 검증",
  product: "QA",
  category: "뷰티",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["youtube"],
  budget_krw: 100000,
  target_audience: "QA 고객",
  goal: "모집 규칙 검증",
  status: "published",
};
const mkCampaign = async (extra) => {
  const r = await brand
    .from("campaigns")
    .insert({ owner_id: a.brand.id, brief, status: "published", ...extra })
    .select("id")
    .single();
  assert.equal(r.error, null, r.error?.message);
  return r.data.id;
};
const apply = (c, campaign) =>
  c.db
    .from("proposals")
    .insert({
      campaign_id: campaign,
      creator_id: c.id,
      brand_id: a.brand.id,
      creator_user_id: c.uid,
      kind: "application",
      brief: "D043 지원 메시지입니다.",
    })
    .select("id")
    .single();
const err = (r) => r.error?.message ?? "";

const c1 = await newCreator("a"),
  c2 = await newCreator("b"),
  c3 = await newCreator("c");

// Publishing with a past deadline is refused (DB clock).
assert.match(
  err(
    await brand.from("campaigns").insert({
      owner_id: a.brand.id,
      brief,
      status: "published",
      recruit_until: new Date(Date.now() - 60000).toISOString(),
    }),
  ),
  /deadline_passed/,
);

// Deadline boundary: apply before, refused after.
const deadline = await mkCampaign({
  recruit_until: new Date(Date.now() + 2500).toISOString(),
});
assert.equal((await apply(c1, deadline)).error, null, "apply before deadline");
assert.ok((await apply(c1, deadline)).error, "duplicate application rejected");
await sleep(3000);
assert.ok((await apply(c2, deadline)).error, "apply after deadline rejected");

// Capacity race: two concurrent selections for one slot → exactly one wins.
const cap = await mkCampaign({ capacity: 1 });
const p1 = (await apply(c1, cap)).data.id,
  p2 = (await apply(c2, cap)).data.id;
const race = await Promise.all([
  brand.rpc("transition_proposal", { p_id: p1, p_action: "accepted" }),
  brand.rpc("transition_proposal", { p_id: p2, p_action: "accepted" }),
]);
assert.equal(race.filter((r) => !r.error).length, 1, "one acceptance");
assert.match(race.map(err).join(" "), /capacity_full/);
assert.ok(
  (await apply(c3, cap)).error,
  "full campaign refuses new applications",
);
// Status transitions.
assert.match(
  err(await brand.from("campaigns").update({ status: "draft" }).eq("id", cap)),
  /has_active_proposals/,
  "cannot go private with selected creators",
);
assert.equal(
  (await brand.from("campaigns").update({ status: "closed" }).eq("id", cap))
    .error,
  null,
);
assert.ok((await apply(c3, cap)).error, "closed campaign refuses applications");
assert.match(
  err(await brand.from("campaigns").update({ status: "draft" }).eq("id", cap)),
  /invalid_transition/,
);
assert.match(
  err(
    await brand
      .from("campaigns")
      .insert({ owner_id: a.brand.id, brief, status: "closed" }),
  ),
  /invalid_status/,
);
const two = await mkCampaign({ capacity: 2 });
for (const c of [c1, c2]) {
  const id = (await apply(c, two)).data.id;
  assert.equal(
    (await brand.rpc("transition_proposal", { p_id: id, p_action: "accepted" }))
      .error,
    null,
  );
}
assert.match(
  err(await brand.from("campaigns").update({ capacity: 1 }).eq("id", two)),
  /capacity_below_selected/,
);
assert.equal(
  (await brand.from("campaigns").update({ status: "closed" }).eq("id", two))
    .error,
  null,
);
// Reopening a full campaign is allowed, but it still accepts no applications.
assert.equal(
  (await brand.from("campaigns").update({ status: "published" }).eq("id", two))
    .error,
  null,
);
assert.ok(
  (await apply(c3, two)).error,
  "reopened but full campaign refuses applications",
);

// Other brand: cannot read drafts, change status/capacity, or select applicants.
const draft = (
  await brand
    .from("campaigns")
    .insert({ owner_id: a.brand.id, brief, status: "draft" })
    .select("id")
    .single()
).data.id;
assert.equal(
  (await other.from("campaigns").select("id").eq("id", draft)).data.length,
  0,
);
assert.equal(
  (
    await other
      .from("campaigns")
      .update({ capacity: 100, status: "closed" })
      .eq("id", cap)
      .select()
  ).data.length,
  0,
);
assert.match(
  err(
    await other.rpc("transition_proposal", { p_id: p2, p_action: "accepted" }),
  ),
  /forbidden/,
);
assert.ok(
  (await other.rpc("campaign_selected", { p_campaign: cap })).data <= 1,
);

for (const id of [deadline, cap, two, draft]) {
  await brand.from("campaigns").update({ status: "closed" }).eq("id", id);
}
console.log(
  "PASS: D043 recruiting — past-deadline publish refused, deadline boundary (DB clock), duplicate application, concurrent selection capped at 1, full/closed refuse applications, private only without active proposals, invalid transitions, capacity >= selected, other brand denied.",
);
