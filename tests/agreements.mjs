// D050 direct REST checks on the isolated local Supabase: versioned terms need the other party's
// acceptance, a one-sided offer never replaces agreed terms, optimistic version + idempotent key,
// concurrent proposals, outsider/direct-write denial, and closed collaborations are read-only.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { publishCreator } from "./support/creator-publication.mjs";
import { ownerSql } from "./support/owner-sql.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const login = async (acc) => {
  const db = client();
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await login(a.brand),
  other = await login(a.other);
const creator = client();
const su = await creator.auth.signUp({
  email: `adme-qa-d050-${randomUUID().slice(0, 8)}@example.com`,
  password: randomUUID() + "Aa!",
  options: { data: { ...qaSignupConsent, role: "creator", name: "D050" } },
});
assert.equal(su.error, null);
const creatorId = `user-${su.data.user.id}`;
assert.equal(
  (
    await publishCreator(creator, {
      name: "D050 조건 검증",
      categories: ["뷰티"],
      vibes: ["자연스러움"],
      formats: ["숏폼"],
      platforms: ["youtube"],
      price_min_krw: null,
      price_max_krw: null,
      is_available: true,
    })
  ).error,
  null,
);
const campaign = (
  await brand
    .from("campaigns")
    .insert({
      owner_id: a.brand.id,
      status: "published",
      brief: {
        title: "D050 조건 합의 검증",
        product: "QA",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["youtube"],
        goal: "조건 합의 검증",
        target_audience: "20대",
        budget_krw: 1000000,
      },
    })
    .select("id")
    .single()
).data.id;
const proposal = (
  await brand.rpc("create_creator_proposal", {
    p_campaign: campaign,
    p_creator: creatorId,
    p_kind: "proposal",
    p_brief: "D050 조건 합의 검증용 제안입니다.",
  })
).data;
assert.ok(proposal, "proposal created");

const terms = (
  budgetKrw,
  deliverables = "숏폼 1편",
  schedule = "12월 둘째 주 게시",
) => ({
  budgetKrw,
  deliverables,
  schedule,
  note: "",
});
const state = async (db) =>
  (await db.rpc("agreement_state", { p_proposal: proposal })).data;
const propose = (db, t, expected, key = randomUUID()) =>
  db.rpc("agreement_propose", {
    p_proposal: proposal,
    p_offer: key,
    p_expected: expected,
    p_terms: t,
  });
const accept = (db, offer, expected) =>
  db.rpc("agreement_accept", {
    p_proposal: proposal,
    p_offer: offer,
    p_expected: expected,
  });
const msg = (r) => r.error?.message ?? "";
const agreed = (s) => s.offers.filter((o) => o.accepted);

try {
  const s0 = await state(brand);
  assert.equal(s0.version, 0);
  assert.equal(s0.writable, true);

  // 1. One-sided proposal is pending, not agreed.
  const k1 = randomUUID();
  const r1 = await propose(brand, terms(500000), 0, k1);
  assert.equal(r1.error, null);
  assert.equal(r1.data.version, 1);
  assert.equal(agreed(r1.data).length, 0, "proposer alone does not confirm");
  // Idempotent retry (same key, same terms) does not bump the version; reuse with other terms is refused.
  assert.equal((await propose(brand, terms(500000), 0, k1)).data.version, 1);
  assert.match(msg(await propose(brand, terms(1), 1, k1)), /key_reused/);
  // Stale version is refused; the proposer cannot accept its own offer.
  assert.match(msg(await propose(creator, terms(600000), 0)), /stale_version/);
  assert.match(msg(await accept(brand, k1, 1)), /not_pending/);

  // 2. The other party accepts → agreed; a retry of the same acceptance is a no-op.
  const r2 = await accept(creator, k1, 1);
  assert.equal(r2.error, null);
  assert.equal(r2.data.version, 2);
  assert.deepEqual(
    agreed(r2.data).map((o) => o.id),
    [k1],
  );
  assert.equal((await accept(creator, k1, 1)).data.version, 2);

  // 3. A new one-sided offer keeps the previous agreement and records what it would replace.
  const k2 = randomUUID();
  const r3 = await propose(creator, terms(700000, "숏폼 2편"), 2, k2);
  assert.equal(r3.error, null);
  assert.deepEqual(
    agreed(r3.data).map((o) => o.id),
    [k1],
    "previous agreement preserved",
  );
  assert.equal(r3.data.offers.at(-1).replaces, k1);
  // Re-sending an earlier acceptance is a no-op: no new event, the pending offer stays pending.
  const again = await accept(creator, k1, 3);
  assert.equal(again.error, null);
  assert.equal(again.data.version, 3);
  assert.equal(again.data.offers.at(-1).accepted, false);

  // 4. Concurrent proposals at the same version: exactly one wins.
  const race = await Promise.all([
    propose(brand, terms(800000), 3),
    propose(creator, terms(900000), 3),
  ]);
  assert.equal(
    race.filter((r) => !r.error).length,
    1,
    "one concurrent proposal wins",
  );
  assert.ok(race.some((r) => /stale_version/.test(msg(r))));

  // 5. Outsiders and direct writes are denied; invalid terms are rejected.
  assert.match(
    msg(await other.rpc("agreement_state", { p_proposal: proposal })),
    /forbidden/,
  );
  assert.match(msg(await propose(other, terms(1), 4)), /forbidden/);
  assert.equal(
    (
      await other
        .from("agreement_offers")
        .select("id")
        .eq("proposal_id", proposal)
    ).data.length,
    0,
  );
  assert.ok(
    (
      await brand.from("agreement_offers").insert({
        id: randomUUID(),
        proposal_id: proposal,
        author_id: a.brand.id,
        terms: terms(1),
        accepted_by: [a.brand.id, su.data.user.id],
      })
    ).error,
    "no direct insert",
  );
  assert.ok(
    (
      await brand
        .from("agreement_offers")
        .update({ accepted_by: [a.brand.id] })
        .eq("id", k1)
    ).error,
    "no direct update",
  );
  assert.deepEqual(
    agreed(await state(brand)).map((o) => o.id),
    [k1],
    "direct update has no effect",
  );
  assert.ok(
    (await propose(brand, { ...terms(1), extra: "x" }, 4)).error,
    "unknown term keys rejected",
  );

  // 6. Closed collaborations are read-only.
  ownerSql(
    `update public.proposals set status='rejected' where id='${proposal}'`,
  );
  const closed = await state(creator);
  assert.equal(closed.writable, false);
  assert.match(
    msg(await propose(creator, terms(1), closed.version)),
    /agreement_locked/,
  );
  console.log(
    "PASS: D050 agreements — one-sided offer pending until the other party accepts, agreed terms preserved under new offers, expected version + idempotent key, concurrent proposals single winner, outsider/direct write denied, closed collaboration read-only",
  );
} finally {
  try {
    ownerSql(
      `delete from public.proposals where campaign_id='${campaign}'; delete from public.campaigns where id='${campaign}'`,
    );
  } catch (e) {
    console.error("cleanup failed", e.message);
  }
}
