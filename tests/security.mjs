import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
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
const { data: orders } = await brand.from("orders").select("id,amount,status");
assert.ok(orders.length);
assert.ok(orders.every((o) => o.amount === 49000 && o.status === "pending"));
assert.equal((await brand.from("entitlements").select("*")).data.length, 0);
assert.equal(
  (await other.from("orders").select("*").eq("owner_id", a.brand.id)).data
    .length,
  0,
);
const { data: p } = await brand
  .from("proposals")
  .select("*")
  .eq("status", "completed")
  .limit(1)
  .single();
assert.ok(p);
assert.equal(
  (await other.from("messages").select("*").eq("proposal_id", p.id)).data
    .length,
  0,
);
assert.ok(
  (await other.rpc("transition_proposal", { p_id: p.id, p_action: "accepted" }))
    .error,
);
const { data: r, error: re } = await creator
  .from("reports")
  .insert({
    reporter_id: a.creator.id,
    creator_id: "creator-001",
    reason: "QA 정정 검토 테스트입니다. 가상 데이터 검증.",
    source_url: "https://example.com/qa-source",
  })
  .select("id")
  .single();
assert.equal(re, null);
assert.ok(
  (await brand.rpc("review_report", { p_id: r.id, p_status: "reviewed" }))
    .error,
);
assert.equal(
  (
    await admin.rpc("admin_review_report", {
      p_id: r.id,
      p_status: "reviewed",
      p_reason: "QA 정정 검토 테스트",
      p_request: crypto.randomUUID(),
    })
  ).error,
  null,
);
assert.equal(
  (await creator.from("reports").select("status").eq("id", r.id).single()).data
    .status,
  "reviewed",
);
assert.ok(
  (await admin.from("audit_log").select("id").eq("entity_id", r.id)).data
    .length,
);
const malformed = await brand
  .from("campaigns")
  .insert({
    owner_id: a.brand.id,
    brief: { title: { invalid: "object" } },
    status: "published",
  });
assert.ok(malformed.error);
assert.equal((await brand.from("campaigns").delete().eq("id", id)).error, null);
console.log(
  "PASS: direct Supabase RLS isolation, privilege escalation, forged entitlement, cross-owner order/message access, invalid transitions, admin moderation + audit. No provider payment simulated.",
);
