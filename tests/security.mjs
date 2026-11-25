import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { totp } from "./support/local-qa.mjs";
const e = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.startsWith("NEXT_PUBLIC_SUPABASE"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replaceAll('"', "")];
    }),
);
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const clients = {};
for (const role of ["brand", "creator", "other", "admin"]) {
  const db = createClient(
    e.NEXT_PUBLIC_SUPABASE_URL,
    e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error } = await db.auth.signInWithPassword(a[role]);
  assert.equal(error, null);
  clients[role] = db;
}
const { brand, creator, other, admin } = clients;
const { data: fixture, error: fixtureError } = await brand
  .from("campaigns")
  .insert({
    owner_id: a.brand.id,
    status: "draft",
    brief: {
      title: "QA 보안 격리 검증",
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["instagram"],
      budget_krw: 100000,
      target_audience: "QA 고객",
      goal: "권한 검증",
      status: "draft",
    },
  })
  .select("id")
  .single();
assert.equal(fixtureError, null);
const id = fixture.id;
assert.equal(
  (await other.from("campaigns").select("id").eq("id", id)).data.length,
  0,
);
assert.ok(
  (
    await other
      .from("campaigns")
      .update({ status: "published" })
      .eq("id", id)
      .select()
  ).data.length === 0,
);
assert.ok(
  (await brand.from("profiles").update({ role: "admin" }).eq("id", a.brand.id))
    .error,
);
assert.ok(
  (
    await brand.rpc("finalize_test_order", {
      p_order: id,
      p_owner: a.brand.id,
      p_payment_key: "fake",
      p_amount: 1,
    })
  ).error,
);
const { data: orders } = await brand
  .from("orders")
  .select("id,sku,amount,status");
const { data: prices } = await brand.from("products").select("sku,amount");
const price = Object.fromEntries(prices.map((p) => [p.sku, p.amount]));
assert.ok(orders.length);
// Server-priced (client amount ignored, e.g. marketplace job_post amount:1) and never paid.
assert.ok(
  orders.every((o) => o.amount === price[o.sku] && o.status === "pending"),
);
assert.equal((await brand.from("entitlements").select("*")).data.length, 0);
assert.equal(
  (await other.from("orders").select("*").eq("owner_id", a.brand.id)).data
    .length,
  0,
);
// Reuses the E2E two-role proposal; any status works (pending is the stronger case for the accept below).
const { data: p } = await brand
  .from("proposals")
  .select("id")
  .limit(1)
  .maybeSingle();
assert.ok(p, "needs a brand proposal from the E2E fixture");
assert.equal(
  (await other.from("messages").select("*").eq("proposal_id", p.id)).data
    .length,
  0,
);
assert.ok(
  (await other.rpc("transition_proposal", { p_id: p.id, p_action: "accepted" }))
    .error,
);
// Reports: direct insert is closed; requests go through submit_report (fresh account: 5/day limit).
assert.ok(
  (
    await creator.from("reports").insert({
      reporter_id: a.creator.id,
      creator_id: "creator-001",
      reason: "직접 삽입 시도입니다. 거부되어야 합니다.",
      source_url: "https://example.com/x",
    })
  ).error,
);
const reporter = createClient(
  e.NEXT_PUBLIC_SUPABASE_URL,
  e.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
// Restored after merge 50f6aa7 dropped the request fixture (r was undefined).
assert.equal(
  (
    await reporter.auth.signUp({
      email: `adme-qa-sec-${Date.now()}@example.com`,
      password: `Sec-${Date.now()}-Aa!`,
      options: { data: { ...qaSignupConsent, role: "brand", name: "QA" } },
    })
  ).error,
  null,
);
const { data: rr, error: re } = await reporter.rpc("submit_report", {
  p_kind: "correction",
  p_creator: "creator-001",
  p_reason: "QA 정정 검토 테스트입니다. 가상 데이터 검증.",
  p_source_url: "https://example.com/qa-source",
});
assert.equal(re, null);
const r = rr[0];
assert.ok(
  (
    await brand.rpc("admin_review_report", {
      p_id: r.id,
      p_status: "reviewed",
      p_reason: "브랜드는 처리 불가",
      p_request: crypto.randomUUID(),
    })
  ).error,
);
const review = () =>
  admin.rpc("admin_review_report", {
    p_id: r.id,
    p_status: "reviewed",
    p_reason: "QA 정정 검토 테스트",
    p_request: crypto.randomUUID(),
  });
// Admin moderation requires a fresh TOTP (aal2) session; password-only is denied.
assert.ok((await review()).error, "password-only admin is denied");
const { data: factors } = await admin.auth.mfa.listFactors();
assert.equal(
  (
    await admin.auth.mfa.challengeAndVerify({
      factorId: factors.totp.find((f) => f.status === "verified").id,
      code: totp(a.admin.totpSecret),
    })
  ).error,
  null,
);
assert.equal((await review()).error, null);
assert.equal(
  (await reporter.from("reports").select("status").eq("id", r.id).single()).data
    .status,
  "resolved",
);
assert.equal(
  (await creator.from("reports").select("id").eq("id", r.id)).data.length,
  0,
  "other users cannot see the request",
);
assert.ok(
  (await admin.from("audit_log").select("id").eq("entity_id", r.id)).data
    .length,
);
const malformed = await brand.from("campaigns").insert({
  owner_id: a.brand.id,
  brief: { title: { invalid: "object" } },
  status: "published",
});
assert.ok(malformed.error);
assert.equal((await brand.from("campaigns").delete().eq("id", id)).error, null);
console.log(
  "PASS: direct Supabase RLS isolation, privilege escalation, forged entitlement, cross-owner order/message access, invalid transitions, admin moderation + audit. No provider payment simulated.",
);
