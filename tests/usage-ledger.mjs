// D069 direct REST: concurrent use never goes negative or double-charges, expiry uses the DB clock and cannot be
// undone, admin grants need a reason and the admin role, revoke recovers credits and closes reservations.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
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
const sql = (q) =>
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
      "-qtA",
    ],
    { input: q, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
const as = async (acc) => {
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
  if (acc) assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const creator = await as(a.creator),
  admin = await elevateAdmin(await as(a.admin), a.admin),
  anon = await as();
const stamp = Date.now();
const acc = {
  email: `ledger-${stamp}@example.test`,
  password: "Ledger-2026-Brand!",
};
const uid = (
  await svc.auth.admin.createUser({
    ...acc,
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role: "brand", name: "원장 검증" },
  })
).data.user.id;
sql(`update profiles set role = 'brand' where id = '${uid}'`);
const brand = await as(acc);
const credits = (id) =>
  Number(sql(`select credits from entitlements where id = '${id}'`));
const key = (s) => `t${stamp}-${s}`;
const reserve = (amount, k) =>
  svc.rpc("credit_reserve", { p_owner: uid, p_amount: amount, p_key: k });
try {
  // A paid TEST purchase of ai_credits (20 credits) through the real finalize path.
  const oid = sql(
    `insert into orders(owner_id, sku, amount) values ('${uid}', 'ai_credits', 4900) returning id`,
  ).split("\n")[0];
  const ent = sql(
    `select finalize_test_order('${oid}', '${uid}', 'pk-${stamp}', 4900)`,
  );
  assert.equal(credits(ent), 20);
  assert.equal(
    sql(
      `select kind || ':' || balance from credit_ledger where entitlement_id = '${ent}'`,
    ),
    "grant:20",
    "opening ledger row",
  );

  // Permissions: reserve/settle are service only; clients cannot write entitlements.
  for (const db of [brand, creator, anon]) {
    assert.ok(
      (
        await db.rpc("credit_reserve", {
          p_owner: uid,
          p_amount: 1,
          p_key: key("x"),
        })
      ).error,
    );
    assert.ok((await db.rpc("release_stale_reservations")).error);
  }
  assert.ok(
    (
      await brand
        .from("entitlements")
        .insert({
          owner_id: uid,
          sku: "ai_credits",
          expires_at: "2099-01-01",
          credits: 999,
          grant_reason: "admin_grant",
          grant_note: "자가 발급 시도",
        })
    ).error,
  );
  await brand.from("entitlements").update({ credits: 999 }).eq("id", ent);
  assert.equal(credits(ent), 20, "client update has no effect");

  // Concurrency: 10 parallel reservations of 3 against 20 → exactly 6 succeed, never negative.
  const res = await Promise.all(
    Array.from({ length: 10 }, (_, i) => reserve(3, key(`c${i}`))),
  );
  assert.equal(res.filter((r) => !r.error).length, 6);
  assert.ok(
    res
      .filter((r) => r.error)
      .every((r) => /insufficient_credits/.test(r.error.message)),
  );
  assert.equal(credits(ent), 2);
  // Same request key in parallel → one reservation, one charge.
  const same = await Promise.all(
    Array.from({ length: 5 }, () => reserve(2, key("same"))),
  );
  assert.equal(new Set(same.map((r) => r.data)).size, 1);
  assert.equal(credits(ent), 0);
  assert.match(
    (await reserve(1, key("same"))).error?.message ?? "",
    /request_key_reused/,
  );
  assert.equal(
    sql(
      `select min(balance) >= 0 and sum(delta) = 0 from credit_ledger where entitlement_id = '${ent}'`,
    ),
    "t",
    "ledger reconciles to the balance",
  );

  // Settle: finalize is idempotent; release after finalize is refused; release refunds.
  const [r0, r1] = res.filter((r) => !r.error).map((r) => r.data);
  assert.equal(
    (await svc.rpc("credit_settle", { p_reservation: r0, p_finalize: true }))
      .data,
    "finalized",
  );
  assert.equal(
    (await svc.rpc("credit_settle", { p_reservation: r0, p_finalize: true }))
      .data,
    "finalized",
  );
  assert.match(
    (await svc.rpc("credit_settle", { p_reservation: r0, p_finalize: false }))
      .error?.message ?? "",
    /already_settled/,
  );
  assert.equal(
    (await svc.rpc("credit_settle", { p_reservation: r1, p_finalize: false }))
      .data,
    "released",
  );
  assert.equal(credits(ent), 3);
  // Stale lease → released by the sweeper.
  const r2 = res.filter((r) => !r.error)[2].data;
  sql(
    `update credit_reservations set expires_at = now() - interval '1 second' where id = '${r2}'`,
  );
  assert.match(
    (await svc.rpc("credit_settle", { p_reservation: r2, p_finalize: true }))
      .error?.message ?? "",
    /reservation_expired/,
  );
  assert.ok((await svc.rpc("release_stale_reservations")).data >= 1);
  assert.equal(credits(ent), 6);

  // Forged / invalid grants.
  for (const db of [brand, creator])
    assert.match(
      (
        await db.rpc("admin_grant_entitlement", {
          p_owner: uid,
          p_sku: "ai_credits",
          p_days: 30,
          p_credits: 100,
          p_note: "부정 발급 시도",
        })
      ).error?.message ?? "",
      /forbidden/,
    );
  assert.match(
    (
      await admin.rpc("admin_grant_entitlement", {
        p_owner: uid,
        p_sku: "ai_credits",
        p_days: 30,
        p_credits: 5,
        p_note: "",
      })
    ).error?.message ?? "",
    /reason_required/,
  );
  assert.match(
    (
      await admin.rpc("admin_grant_entitlement", {
        p_owner: uid,
        p_sku: "creator_hot",
        p_days: 30,
        p_credits: 0,
        p_note: "역할 불일치 확인",
      })
    ).error?.message ?? "",
    /invalid_grant/,
  );
  assert.match(
    (
      await admin.rpc("admin_grant_entitlement", {
        p_owner: uid,
        p_sku: "ai_credits",
        p_days: 365,
        p_credits: 5,
        p_note: "기간 초과 확인",
      })
    ).error?.message ?? "",
    /invalid_grant/,
  );
  const g = await admin.rpc("admin_grant_entitlement", {
    p_owner: uid,
    p_sku: "ai_credits",
    p_days: 1,
    p_credits: 5,
    p_note: "TEST 보상 발급",
  });
  assert.equal(g.error, null);
  assert.equal(
    sql(
      `select grant_reason || '|' || grant_note || '|' || (granted_by = '${a.admin.id}') from entitlements where id = '${g.data}'`,
    ),
    "admin_grant|TEST 보상 발급|true",
  );
  assert.equal(
    sql(
      `select count(*) from audit_log where entity_id = '${g.data}' and action = 'entitlement:grant'`,
    ),
    "1",
  );

  // Expiry boundary (DB clock). Earliest-expiring entitlement is spent first, i.e. the 1-day grant.
  const rg = (await reserve(1, key("exp"))).data;
  assert.equal(
    sql(`select entitlement_id from credit_reservations where id = '${rg}'`),
    g.data,
    "earliest-expiring entitlement used first",
  );
  sql(
    `update entitlements set expires_at = now() + interval '1 second' where id = '${g.data}'`,
  );
  await new Promise((r) => setTimeout(r, 1500));
  assert.match(
    (await svc.rpc("credit_settle", { p_reservation: rg, p_finalize: true }))
      .error?.message ?? "",
    /reservation_expired/,
  );
  assert.equal(
    (await svc.rpc("credit_settle", { p_reservation: rg, p_finalize: false }))
      .data,
    "released",
  );
  assert.equal(
    credits(g.data),
    4,
    "release does not refund into an expired entitlement",
  );
  assert.throws(
    () =>
      sql(
        `update entitlements set expires_at = now() + interval '30 days' where id = '${g.data}'`,
      ),
    /entitlement_period_fixed/,
  );
  assert.throws(
    () =>
      sql(
        `update entitlements set credits = credits + 1 where id = '${g.data}'`,
      ),
    /entitlement_inactive/,
  );
  const rp = (await reserve(1, key("after-exp"))).data;
  assert.equal(
    sql(`select entitlement_id from credit_reservations where id = '${rp}'`),
    ent,
    "expired grant skipped",
  );

  // Revoke (cancel/recover): balance → 0, open reservation closed without refund, order cancelled, no revival.
  assert.match(
    (
      await brand.rpc("revoke_entitlement", {
        p_id: ent,
        p_reason: "부정 회수 시도",
      })
    ).error?.message ?? "",
    /forbidden/,
  );
  assert.match(
    (await admin.rpc("revoke_entitlement", { p_id: ent, p_reason: "" })).error
      ?.message ?? "",
    /reason_required/,
  );
  assert.equal(
    (
      await admin.rpc("revoke_entitlement", {
        p_id: ent,
        p_reason: "TEST 결제 취소",
      })
    ).error,
    null,
  );
  assert.equal(credits(ent), 0);
  assert.equal(
    sql(`select status from credit_reservations where id = '${rp}'`),
    "released",
  );
  assert.equal(
    sql(`select status from orders where id = '${oid}'`),
    "cancelled",
  );
  assert.match(
    (await svc.rpc("credit_settle", { p_reservation: rp, p_finalize: true }))
      .error?.message ?? "",
    /already_settled/,
  );
  assert.match(
    (await reserve(1, key("after-revoke"))).error?.message ?? "",
    /insufficient_credits/,
  );
  assert.throws(
    () => sql(`update entitlements set revoked_at = null where id = '${ent}'`),
    /entitlement_revoked/,
  );
  assert.match(
    (
      await admin.rpc("revoke_entitlement", {
        p_id: ent,
        p_reason: "두 번째 회수",
      })
    ).error?.message ?? "",
    /not_found/,
  );
  assert.equal(
    sql(
      `select bool_and(balance >= 0) from credit_ledger where owner_id = '${uid}'`,
    ),
    "t",
  );

  // Reads: own ledger only.
  assert.ok(
    (await brand.from("credit_ledger").select("id").eq("owner_id", uid)).data
      .length > 0,
  );
  for (const db of [creator, anon])
    assert.deepEqual(
      (await db.from("credit_ledger").select("id").eq("owner_id", uid)).data ??
        [],
      [],
    );
} finally {
  sql(
    `delete from entitlements where owner_id = '${uid}'; delete from orders where owner_id = '${uid}'`,
  );
  await svc.auth.admin.deleteUser(uid);
}
console.log(
  "PASS: D069 usage ledger — 10 concurrent reserves → 6 ok/never negative, same key charged once, finalize/release idempotent, stale sweep, DB-clock expiry (no refund/extension/revival), admin grant needs role+reason, revoke recovers + cancels order",
);
