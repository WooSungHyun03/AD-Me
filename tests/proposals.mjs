// D049 direct DB regression on the isolated local Supabase: every proposal/application transition,
// duplicates, concurrent accept/reject, participant permissions, history atomicity, hidden creators.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { elevateAdmin } from "./support/admin-mfa.mjs";
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
  other = await login(a.other),
  admin = await elevateAdmin(await login(a.admin), a.admin);
const err = (r) => r.error?.message ?? "";

async function newCreator(tag) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `adme-qa-d049-${tag}-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role: "creator", name: "D049" } },
  });
  assert.equal(error, null);
  const uid = data.user.id,
    id = `user-${uid}`;
  const profile = {
    name: `D049 ${tag}`,
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
  title: "D049 상태 검증",
  product: "QA",
  category: "뷰티",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["youtube"],
  budget_krw: 100000,
  target_audience: "QA 고객",
  goal: "상태 머신 검증",
  status: "published",
};
const campaign = (
  await brand
    .from("campaigns")
    .insert({ owner_id: a.brand.id, brief, status: "published" })
    .select("id")
    .single()
).data.id;
// Proposals/applications are created through the same RPC as POST /api/proposals.
const viaRpc = async (db, args) => {
  const r = await db.rpc("create_creator_proposal", args);
  return { ...r, data: r.data ? { id: r.data } : null };
};
const propose = (c) =>
  viaRpc(brand, {
    p_campaign: campaign,
    p_creator: c.id,
    p_kind: "proposal",
    p_brief: "D049 브랜드 제안 메시지입니다.",
  });
const apply = (c) =>
  viaRpc(c.db, {
    p_campaign: campaign,
    p_creator: c.id,
    p_kind: "application",
    p_brief: "D049 크리에이터 지원 메시지입니다.",
  });
const act = (db, id, action) =>
  db.rpc("transition_proposal", { p_id: id, p_action: action });
const history = async (db, id) =>
  (
    await db
      .from("proposal_events")
      .select("to_status,actor_id,recipient_id")
      .eq("proposal_id", id)
      .order("id")
  ).data;

const c1 = await newCreator("a"),
  c2 = await newCreator("b"),
  c3 = await newCreator("c"),
  c4 = await newCreator("d");

// 1. Proposal: creation logs an event to the creator; brand cannot accept its own proposal.
const p1 = (await propose(c1)).data.id;
assert.ok(
  (await propose(c1)).error,
  "duplicate proposal for same campaign+creator rejected",
);
assert.ok(
  (await apply(c1)).error,
  "application after a proposal for the same pair rejected",
);
assert.deepEqual(await history(brand, p1), [
  { to_status: "pending", actor_id: a.brand.id, recipient_id: c1.uid },
]);
assert.match(err(await act(brand, p1, "accepted")), /invalid transition/);
assert.match(
  err(await act(c1.db, p1, "cancelled")),
  /invalid transition/,
  "recipient cannot cancel",
);
assert.match(
  err(await act(other, p1, "rejected")),
  /forbidden/,
  "non-participant denied",
);
assert.match(
  err(await act(c2.db, p1, "accepted")),
  /forbidden/,
  "other creator denied",
);

// 1b. Plain messages work for both sides while pending; deliverables only from the creator after acceptance.
assert.equal(
  (
    await brand
      .from("messages")
      .insert({
        proposal_id: p1,
        sender_id: a.brand.id,
        kind: "message",
        body: "브랜드 메시지",
      })
  ).error,
  null,
);
assert.equal(
  (
    await c1.db
      .from("messages")
      .insert({
        proposal_id: p1,
        sender_id: c1.uid,
        kind: "message",
        body: "크리에이터 답장",
      })
  ).error,
  null,
);
assert.ok(
  (
    await brand
      .from("messages")
      .insert({
        proposal_id: p1,
        sender_id: a.brand.id,
        kind: "deliverable",
        body: "브랜드 결과물",
        url: "https://example.com/x",
      })
  ).error,
);
assert.ok(
  (
    await c1.db
      .from("messages")
      .insert({
        proposal_id: p1,
        sender_id: c1.uid,
        kind: "deliverable",
        body: "수락 전 결과물",
        url: "https://example.com/x",
      })
  ).error,
);
assert.ok(
  (
    await other
      .from("messages")
      .insert({
        proposal_id: p1,
        sender_id: a.other.id,
        kind: "message",
        body: "제3자",
      })
  ).error,
);
// 2. Concurrent accept vs reject by the recipient: exactly one wins, history has exactly one decision.
const race = await Promise.all([
  act(c1.db, p1, "accepted"),
  act(c1.db, p1, "rejected"),
]);
assert.equal(race.filter((r) => !r.error).length, 1, "one decision wins");
const decided = race.find((r) => !r.error).data;
const h1 = await history(c1.db, p1);
assert.deepEqual(
  h1.map((e) => e.to_status),
  ["pending", decided],
);
assert.equal(h1[1].recipient_id, a.brand.id, "decision notifies the brand");

// 3. Full collaboration path on an application: accept → submit (needs deliverable) → revision → submit → complete.
const p2 = (await apply(c2)).data.id;
assert.match(
  err(await act(c2.db, p2, "accepted")),
  /invalid transition/,
  "applicant cannot self-accept",
);
assert.equal((await act(brand, p2, "accepted")).error, null);
assert.match(
  err(await act(c2.db, p2, "submitted")),
  /invalid transition/,
  "submit needs a deliverable",
);
// D054: results are versioned snapshots; submit/review go through delivery_transition on the
// current room revision (the same RPCs as /api/deliverables and PATCH /api/proposals).
const room = async (db = c2.db) => {
  const r = await db.rpc("delivery_page", { p_proposal: p2, p_before: null, p_limit: 20 });
  assert.equal(r.error, null);
  return r.data;
};
const deliver = async () => {
  const r = await c2.db.rpc("delivery_create", {
    p_proposal: p2,
    p_expected: (await room()).roomRevision,
    p_key: randomUUID(),
    p_body: "결과물 제출",
    p_url: "https://example.com/d049",
    p_declaration: "marked",
  });
  return r;
};
const review = async (db, action) => {
  const page = await room(db);
  return db.rpc("delivery_transition", {
    p_proposal: p2,
    p_submission: page.active.id,
    p_expected: page.roomRevision,
    p_key: randomUUID(),
    p_action: action,
    p_note: action === "submitted" ? "" : "D049 검토 근거와 피드백",
    p_checked: action === "completed",
  });
};
assert.equal((await deliver()).error, null);
assert.equal((await review(c2.db, "submitted")).error, null);
assert.ok(
  (await review(c2.db, "completed")).error,
  "creator cannot approve own work",
);
assert.equal((await review(brand, "revision_requested")).error, null);
assert.equal((await deliver()).error, null);
assert.equal((await review(c2.db, "submitted")).error, null);
assert.equal((await review(brand, "completed")).error, null);
assert.match(
  err(await act(brand, p2, "accepted")),
  /invalid transition/,
  "completed is final",
);
// Request history keeps the request decisions; review steps live in the versioned delivery log.
assert.deepEqual(
  (await history(brand, p2)).map((e) => e.to_status),
  ["pending", "accepted"],
);
assert.equal(
  (await brand.from("proposals").select("status").eq("id", p2).single()).data
    .status,
  "completed",
);

// 4. Cancel: only the initiator, only while pending; cancelled closes messaging.
const p3 = (await apply(c3)).data.id;
assert.match(
  err(await act(brand, p3, "cancelled")),
  /invalid transition/,
  "brand cannot cancel an application",
);
assert.equal((await act(c3.db, p3, "cancelled")).error, null);
assert.match(
  err(await act(brand, p3, "accepted")),
  /invalid transition/,
  "cancelled is final",
);
assert.ok(
  (
    await c3.db.from("messages").insert({
      proposal_id: p3,
      sender_id: c3.uid,
      kind: "message",
      body: "취소 후",
    })
  ).error,
);
assert.match(
  err(await act(c2.db, p2, "cancelled")),
  /invalid transition/,
  "cannot cancel after acceptance",
);

// 5. Hidden (moderated) creator cannot enter a collaboration; nothing is written on failure.
const p4 = (await propose(c4)).data.id;
assert.equal(
  (
    await admin.rpc("moderate_entity", {
      p_kind: "creator",
      p_id: c4.id,
      p_published: false,
    })
  ).error,
  null,
);
assert.match(err(await act(c4.db, p4, "accepted")), /creator_unavailable/);
assert.equal(
  (await brand.from("proposals").select("status").eq("id", p4).single()).data
    .status,
  "pending",
);
assert.deepEqual(
  (await history(brand, p4)).map((e) => e.to_status),
  ["pending"],
  "failed transition left no event",
);
assert.ok(
  (await propose({ ...c4 })).error,
  "no new proposal to a hidden creator",
);

// 6. History and status cannot be forged or read by outsiders.
assert.equal(
  (await other.from("proposal_events").select("id").eq("proposal_id", p2)).data
    .length,
  0,
);
assert.ok(
  (
    await c2.db.from("proposal_events").insert({
      proposal_id: p2,
      recipient_id: a.brand.id,
      to_status: "completed",
    })
  ).error,
);
assert.equal(
  (await c2.db.from("proposal_events").delete().eq("proposal_id", p2).select())
    .data?.length ?? 0,
  0,
);
assert.equal(
  (
    await c1.db
      .from("proposals")
      .update({ status: "completed" })
      .eq("id", p1)
      .select()
  ).data?.length ?? 0,
  0,
);
assert.equal(
  (await brand.from("proposals").select("status").eq("id", p1).single()).data
    .status,
  decided,
);

await admin.rpc("moderate_entity", {
  p_kind: "creator",
  p_id: c4.id,
  p_published: true,
});
await brand.from("campaigns").update({ status: "closed" }).eq("id", campaign);
console.log(
  "PASS: D049 proposals — duplicate pair, role-gated accept/reject/cancel, concurrent accept vs reject (one wins, one event), application full path with deliverable gate and revision, final states, cancelled closes messaging, hidden creator blocked atomically, events participant-only and unforgeable, no direct status update.",
);
