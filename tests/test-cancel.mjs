// D068 direct REST: TEST cancellation state machine (DB side). Provider calls are NOT exercised here — paid orders
// are simulated with finalize_test_order and a fake key (no Toss keys locally; provider cancel stays BLOCKED).
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
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
    {
      input: q,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  ).trim();
const client = async (acc) => {
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
const email = `cancel-${Date.now()}@example.com`,
  password = `Pw-${randomUUID()}`;
const { data: made, error: me } = await svc.auth.admin.createUser({ user_metadata: { ...qaSignupConsent },
  email,
  password,
  email_confirm: true,
});
assert.equal(me, null);
const uid = made.user.id;
sql(`update profiles set role = 'brand' where id = '${uid}'`);
const owner = await client({ email, password }),
  other = await client(a.other),
  admin = await elevateAdmin(await client(a.admin), a.admin),
  anon = await client();
const orders = [];
const paidOrder = async (sku = "ai_credits") => {
  const id = sql(
    `insert into orders(owner_id, sku, amount) select '${uid}', sku, amount from products where sku = '${sku}' returning id`,
  )
    .split("\n")
    .pop();
  orders.push(id);
  const amount = Number(sql(`select amount from orders where id = '${id}'`));
  const { data: ent, error } = await svc.rpc("finalize_test_order", {
    p_order: id,
    p_owner: uid,
    p_payment_key: `fake_${randomUUID()}`,
    p_amount: amount,
  });
  assert.equal(error, null);
  return { id, ent };
};
const begin = (order, key, who = uid) =>
  svc.rpc("begin_test_cancel", {
    p_order: order,
    p_owner: who,
    p_reason: "테스트 취소",
    p_key: key,
  });
const finish = (id, ok, status, code) =>
  svc.rpc("finish_test_cancel", {
    p_id: id,
    p_ok: ok,
    p_provider_status: status,
    p_error: code,
  });
const errOf = async (p) => (await p).error?.message;
try {
  const o1 = await paidOrder();
  // Clients cannot drive the state machine or write cancellation rows.
  for (const db of [owner, other, anon]) {
    assert.ok(
      await errOf(
        db.rpc("begin_test_cancel", {
          p_order: o1.id,
          p_owner: uid,
          p_reason: "xx",
          p_key: randomUUID(),
        }),
      ),
      "client begin denied",
    );
    assert.ok(
      await errOf(
        db.rpc("finish_test_cancel", {
          p_id: randomUUID(),
          p_ok: true,
          p_provider_status: null,
          p_error: null,
        }),
      ),
      "client finish denied",
    );
    const ins = await db
      .from("payment_cancellations")
      .insert({
        order_id: o1.id,
        owner_id: uid,
        idempotency_key: randomUUID(),
        reason: "xx",
      });
    assert.ok(ins.error, "client insert denied");
  }
  // Another user cannot cancel this order (the Edge Function passes the caller's uid; paymentKey is never accepted).
  assert.equal(
    await errOf(begin(o1.id, randomUUID(), a.other.id)),
    "not_found",
  );

  // Happy path + idempotency.
  const k1 = randomUUID();
  const r1 = (await begin(o1.id, k1)).data[0];
  assert.equal(r1.status, "requested");
  assert.match(r1.payment_key, /^fake_/);
  assert.equal(
    (await begin(o1.id, k1)).data[0].cancellation_id,
    r1.cancellation_id,
    "same key → same row",
  );
  assert.equal(await errOf(begin(o1.id, randomUUID())), "cancel_in_progress");
  assert.equal(
    await errOf(
      svc.rpc("begin_test_cancel", {
        p_order: o1.id,
        p_owner: a.other.id,
        p_reason: "xx",
        p_key: k1,
      }),
    ),
    "idempotency_conflict",
  );
  assert.equal(
    (await finish(r1.cancellation_id, true, "CANCELED", null)).data,
    "done",
  );
  assert.equal(
    sql(`select status from orders where id = '${o1.id}'`),
    "cancelled",
  );
  assert.equal(
    sql(
      `select (revoked_at is not null)::text || '|' || credits from entitlements where id = '${o1.ent}'`,
    ),
    "true|0",
  );
  assert.equal(
    sql(
      `select kind || '|' || delta || '|' || balance from credit_ledger where entitlement_id = '${o1.ent}' order by id desc limit 1`,
    ),
    "revoke|-20|0",
  );
  assert.equal(
    sql(
      `select count(*) from audit_log where entity_id = '${o1.id}' and action in ('order:cancel_requested','order:cancelled')`,
    ),
    "2",
  );
  assert.equal(
    (await finish(r1.cancellation_id, false, null, "X")).data,
    "done",
    "finish is idempotent",
  );
  assert.equal(
    (await begin(o1.id, k1)).data[0].status,
    "done",
    "replay returns done",
  );
  assert.equal(await errOf(begin(o1.id, randomUUID())), "already_cancelled");

  // Provider refusal: order and entitlement stay; a new attempt is allowed.
  const o2 = await paidOrder("creator_hot");
  const r2 = (await begin(o2.id, randomUUID())).data[0];
  assert.equal(
    (await finish(r2.cancellation_id, false, "DONE", "NOT_CANCELABLE_PAYMENT"))
      .data,
    "failed",
  );
  assert.equal(sql(`select status from orders where id = '${o2.id}'`), "paid");
  assert.equal(
    sql(
      `select (revoked_at is null)::text from entitlements where id = '${o2.ent}'`,
    ),
    "true",
  );
  assert.equal(
    sql(
      `select error_code from payment_cancellations where id = '${r2.cancellation_id}'`,
    ),
    "NOT_CANCELABLE_PAYMENT",
  );
  assert.equal(
    (await begin(o2.id, randomUUID())).data[0].status,
    "requested",
    "retry after failure allowed",
  );

  // Credits rule: in-flight reservation → credits_in_use; finalized use → credits_used.
  await paidOrder(); // the reservation may land on any active credit entitlement of this user
  const res = await svc.rpc("credit_reserve", {
    p_owner: uid,
    p_amount: 1,
    p_key: `cancel:${randomUUID()}`,
  });
  assert.equal(res.error, null);
  const reservedEnt = sql(
    `select entitlement_id from credit_reservations where id = '${res.data}'`,
  );
  const reservedOrder = sql(
    `select order_id from entitlements where id = '${reservedEnt}'`,
  );
  assert.equal(
    await errOf(begin(reservedOrder, randomUUID())),
    "credits_in_use",
  );
  assert.equal(
    (
      await svc.rpc("credit_settle", {
        p_reservation: res.data,
        p_finalize: true,
      })
    ).error,
    null,
  );
  assert.equal(await errOf(begin(reservedOrder, randomUUID())), "credits_used");

  // Not paid → not cancellable.
  const pending = sql(
    `insert into orders(owner_id, sku, amount) values ('${uid}', 'ai_credits', 4900) returning id`,
  )
    .split("\n")
    .pop();
  orders.push(pending);
  assert.equal(await errOf(begin(pending, randomUUID())), "not_cancellable");

  // Read access: owner sees own rows, another user none, admin all of them.
  const n = Number(
    sql(`select count(*) from payment_cancellations where owner_id = '${uid}'`),
  );
  assert.equal(
    (await owner.from("payment_cancellations").select("id")).data.length,
    n,
  );
  assert.equal(
    (await other.from("payment_cancellations").select("id").eq("owner_id", uid))
      .data.length,
    0,
  );
  assert.equal(
    (await anon.from("payment_cancellations").select("id")).data.length,
    0,
  );
  assert.equal(
    (await admin.from("payment_cancellations").select("id").eq("owner_id", uid))
      .data.length,
    n,
  );
  console.log("PASS test-cancel");
} finally {
  const ids = orders.map((o) => `'${o}'`).join(",") || "null";
  sql(`delete from payment_cancellations where order_id in (${ids});
       delete from credit_ledger where owner_id = '${uid}'; delete from credit_reservations where owner_id = '${uid}';
       delete from entitlements where owner_id = '${uid}'; delete from orders where owner_id = '${uid}';`);
  await svc.auth.admin.deleteUser(uid).catch(() => {});
}
