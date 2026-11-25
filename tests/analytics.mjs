// D006 direct REST + DB: pseudonymous funnel events — writes only via triggers/RPC, dedupe, opt-out erase,
// account-deletion erase, admin-only aggregate, no raw identifiers stored.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { totp } from "./support/local-qa.mjs";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    { input: q, encoding: "utf8" },
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
const brand = await as(a.brand),
  creator = await as(a.creator),
  anon = await as(),
  admin = await as(a.admin);
const subj = (id) => sql(`select analytics_subject('${id}')`);
const events = (id, ev) =>
  Number(
    sql(
      `select count(*) from product_events where subject = '${subj(id)}' and event = '${ev}'`,
    ),
  );

// Direct writes and helper functions are closed to clients.
for (const db of [anon, brand, creator]) {
  assert.ok(
    (
      await db
        .from("product_events")
        .insert({
          event: "signup",
          subject: "p:" + "0".repeat(32),
          dedupe_key: "x",
        })
    ).error,
  );
  assert.ok(
    (
      await db.rpc("record_event", {
        p_event: "accept",
        p_user: a.brand.id,
        p_key: "forged",
      })
    ).error,
  );
  assert.ok((await db.rpc("analytics_subject", { u: a.brand.id })).error);
  assert.deepEqual(
    (await db.from("analytics_secret").select("*")).data ?? [],
    [],
  );
  assert.deepEqual(
    (await db.from("product_events").select("*")).data ?? [],
    [],
    "non-admin sees no events",
  );
  assert.ok((await db.rpc("product_funnel")).error, "aggregate is admin-only");
}
assert.ok(
  (await brand.from("profiles").update({ role: "admin" }).eq("id", a.brand.id))
    .error ||
    sql(`select role from profiles where id='${a.brand.id}'`) === "brand",
);

// Dedupe: explore twice the same day = one; shortlist re-add = one.
await brand.rpc("track_explore");
await brand.rpc("track_explore");
// Count only today's (KST) key: the shared QA brand may carry explore events from earlier days.
assert.equal(
  Number(
    sql(
      `select count(*) from product_events where subject = '${subj(a.brand.id)}' and event = 'explore' and dedupe_key like '%:' || to_char(now() at time zone 'Asia/Seoul', 'YYYY-MM-DD')`,
    ),
  ),
  1,
  "explore counted once per day",
);
const cid = sql(`select id from creators where published limit 1`);
const list = (await brand.rpc("ensure_default_list")).data;
const before = events(a.brand.id, "shortlist");
for (let i = 0; i < 2; i++) {
  await brand
    .from("saved_list_items")
    .delete()
    .eq("list_id", list)
    .eq("creator_id", cid);
  assert.equal(
    (
      await brand
        .from("saved_list_items")
        .insert({ list_id: list, creator_id: cid, owner_id: a.brand.id })
    ).error,
    null,
  );
}
assert.ok(
  events(a.brand.id, "shortlist") - before <= 1,
  "re-saving the same creator counts once",
);
assert.equal(
  Number(
    sql(
      `select count(*) from product_events where dedupe_key like 'shortlist:%${cid}%'`,
    ),
  ),
  0,
  "creator id not stored raw",
);

// No raw identifiers in any stored event.
const dump = sql(
  `select coalesce(string_agg(row_to_json(e)::text, ''), '') from product_events e`,
);
for (const acc of [a.brand, a.creator, a.admin]) {
  assert.ok(
    !dump.includes(acc.id) && !dump.includes(acc.email),
    "no user id/email in events",
  );
}

// The admin aggregate requires a fresh, real local TOTP verification.
assert.ok((await admin.rpc("product_funnel")).error, "password-only admin is denied");
const { data: factors, error: factorError } = await admin.auth.mfa.listFactors();
assert.equal(factorError, null);
const factor = factors.totp.find((item) => item.status === "verified");
assert.ok(factor, "verified local test factor");
const verified = await admin.auth.mfa.challengeAndVerify({
  factorId: factor.id,
  code: totp(a.admin.totpSecret),
});
assert.equal(verified.error, null);
const { data: funnel, error } = await admin.rpc("product_funnel", {
  p_days: 30,
});
assert.equal(error, null);
assert.deepEqual(Object.keys(funnel).sort(), [
  "accept",
  "explore",
  "proposal",
  "shortlist",
  "signup",
]);
assert.ok(funnel.explore >= 1 && funnel.proposal >= 1 && funnel.accept >= 1 && Object.values(funnel).every(Number.isInteger));

// Opt-out: past events erased, new ones not recorded; opting back in resumes.
assert.equal(
  (
    await brand
      .from("profiles")
      .update({ analytics_opt_out: true })
      .eq("id", a.brand.id)
  ).error,
  null,
);
assert.equal(
  Number(
    sql(
      `select count(*) from product_events where subject = '${subj(a.brand.id)}'`,
    ),
  ),
  0,
  "opt-out erases",
);
await brand.rpc("track_explore");
assert.equal(events(a.brand.id, "explore"), 0, "opted-out user not tracked");
await brand
  .from("profiles")
  .update({ analytics_opt_out: false })
  .eq("id", a.brand.id);
await brand.rpc("track_explore");
assert.equal(events(a.brand.id, "explore"), 1);

// Signup on account creation; account deletion erases.
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const tmp = await svc.auth.admin.createUser({ user_metadata: { ...qaSignupConsent },
  email: `qa-events-${Date.now()}@example.test`,
  password: crypto.randomUUID(),
  email_confirm: true,
});
assert.equal(tmp.error, null);
const s = subj(tmp.data.user.id);
assert.equal(events(tmp.data.user.id, "signup"), 1, "signup recorded");
assert.equal((await svc.auth.admin.deleteUser(tmp.data.user.id)).error, null);
assert.equal(
  Number(sql(`select count(*) from product_events where subject = '${s}'`)),
  0,
  "deletion erases",
);
console.log(
  "PASS: D006 events — client writes/forgery denied, explore & shortlist deduped, no raw ids/emails, admin-only funnel, opt-out & deletion erase",
);
