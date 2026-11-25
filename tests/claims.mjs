// D025 direct-DB checks against an ISOLATED local Supabase only (needs service key for fixtures).
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { ownerSql, lit, jsonLit } from "./support/owner-sql.mjs";
import { elevateAdmin } from "./support/admin-mfa.mjs";
const e = Object.fromEntries(
  readFileSync(".env.local", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const url = e.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(url)) throw new Error("claims.mjs runs only against local Supabase");
const opts = { auth: { persistSession: false } };
const svc = createClient(url, e.SUPABASE_SERVICE_ROLE_KEY, opts);
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
async function as(creds) {
  const db = createClient(url, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
  assert.equal((await db.auth.signInWithPassword(creds)).error, null);
  return db;
}
async function newCreator() {
  const db = createClient(url, e.NEXT_PUBLIC_SUPABASE_ANON_KEY, opts);
  const creds = { email: `adme-qa-claim-${randomUUID().slice(0, 8)}@example.com`, password: randomUUID() + "Aa!" };
  const { data, error } = await db.auth.signUp({ ...creds, options: { data: { ...qaSignupConsent, role: "creator", name: "청구 검증" } } });
  assert.equal(error, null);
  return { db, id: data.user.id };
}
const errCode = (r) => r.error?.message;
const collected = `yt-qa-${randomUUID().slice(0, 8)}`;
const profile = {
  name: "수집 검증 채널", handle: "qa", bio: "", categories: [], vibes: [], formats: [], platforms: ["youtube"],
  price_min_krw: 0, price_max_krw: 0, followers: 0, is_available: false, is_demo: false,
  data_source: "youtube_data_api", metrics_source: "youtube_data_api",
};
// Collected (ownerless) profiles are published by the ingestion pipeline, not a user consent
// transaction; the D073 guard refuses service-key publication, so the fixture uses owner SQL.
ownerSql(`insert into public.creators(id,published,profile) values(${lit(collected)},true,${jsonLit(profile)})`);
try {
  const brand = await as(a.brand), admin = await elevateAdmin(await as(a.admin), a.admin);
  const A = await newCreator(), B = await newCreator();
  const row = async () => (await svc.from("creators").select("owner_id,claim_status").eq("id", collected).single()).data;
  assert.equal((await row()).claim_status, "unclaimed");

  assert.match(errCode(await brand.rpc("start_claim", { p_creator: collected })), /forbidden/);
  assert.match(errCode(await A.db.rpc("start_claim", { p_creator: "creator-001" })), /not_claimable/);
  const first = await A.db.rpc("start_claim", { p_creator: collected });
  assert.equal(first.error, null);
  assert.match(first.data[0].code, /^ADME-[0-9A-F]{10}$/);
  assert.match(errCode(await A.db.rpc("start_claim", { p_creator: collected })), /duplicate_claim/);
  const second = await B.db.rpc("start_claim", { p_creator: collected });
  assert.equal(second.error, null);
  assert.equal((await row()).claim_status, "pending");

  // Code hash unreadable; claimants see only their own claims.
  assert.ok((await A.db.from("creator_claims").select("code_hash")).error);
  const mine = (await A.db.from("creator_claims").select("id,claimant_id")).data;
  assert.ok(mine.length === 1 && mine[0].claimant_id === A.id);
  // No ownership by direct REST.
  await A.db.from("creators").update({ owner_id: A.id }).eq("id", collected);
  assert.ok((await A.db.from("creator_claims").update({ status: "verified" }).eq("id", mine[0].id)).error);
  assert.equal((await row()).owner_id, null);
  assert.match(errCode(await A.db.rpc("review_claim", { p_claim: mine[0].id, p_approve: true })), /forbidden/);
  // Brand cannot propose to an unclaimed profile.
  const { data: camp } = await brand.from("campaigns").insert({
    owner_id: a.brand.id, status: "published",
    brief: { title: "청구 검증", product: "p", category: "뷰티", format: "숏폼", goal: "검증 목표", target_audience: "검증 대상", vibes: ["청아함"], budget_krw: 100000 },
  }).select("id").single();
  assert.ok((await brand.from("proposals").insert({ campaign_id: camp.id, creator_id: collected, brand_id: a.brand.id, creator_user_id: A.id, kind: "proposal", brief: "청구 전 제안 시도 검증입니다." })).error);

  // Expired claim cannot be approved.
  await svc.from("creator_claims").update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq("id", first.data[0].claim_id);
  assert.equal((await admin.rpc("review_claim", { p_claim: first.data[0].claim_id, p_approve: true })).data, "expired");
  assert.equal((await row()).owner_id, null);
  // Approval requires the code actually posted on the channel.
  const sid = second.data[0].claim_id;
  assert.match(errCode(await admin.rpc("review_claim", { p_claim: sid, p_approve: true })), /code_mismatch/);
  assert.match(errCode(await admin.rpc("review_claim", { p_claim: sid, p_approve: true, p_code: first.data[0].code })), /code_mismatch/);
  assert.equal((await row()).owner_id, null);
  // Approve the competing claim; ownership moves exactly once.
  assert.equal((await admin.rpc("review_claim", { p_claim: sid, p_approve: true, p_code: second.data[0].code.toLowerCase() })).data, "verified");
  assert.deepEqual(await row(), { owner_id: B.id, claim_status: "verified" });
  assert.match(errCode(await admin.rpc("review_claim", { p_claim: sid, p_approve: true, p_code: second.data[0].code })), /not_pending/);
  assert.match(errCode(await A.db.rpc("start_claim", { p_creator: collected })), /not_claimable/);
  // Owner cannot silently drop claim state.
  assert.ok((await B.db.from("creators").update({ claim_status: "unclaimed" }).eq("id", collected)).error);
  const audit = (await svc.from("audit_log").select("action").eq("entity_id", collected)).data.map((x) => x.action);
  assert.deepEqual(audit.sort(), ["claim_started", "claim_started", "claim_verified"]);
  await svc.from("campaigns").delete().eq("id", camp.id);
  console.log("PASS: D025 claims — role gate, demo not claimable, duplicate, hidden code hash, no REST ownership, no pre-claim proposal, expiry, single approval, audit.");
} finally {
  await svc.from("audit_log").delete().eq("entity_id", collected);
  await svc.from("creators").delete().eq("id", collected);
}
