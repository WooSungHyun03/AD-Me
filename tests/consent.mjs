// D015 direct REST + DB: defaults, server-recorded version/time, change log, direct writes denied,
// marketing audience = current consenters only, withdrawal cancels queued mail, service email follows its own switch.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
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
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const mk = async () => {
  const cred = {
    email: `qa-consent-${crypto.randomUUID().slice(0, 8)}@example.test`,
    password: crypto.randomUUID(),
  };
  const u = await svc.auth.admin.createUser({ user_metadata: { ...qaSignupConsent }, ...cred, email_confirm: true });
  assert.equal(u.error, null);
  const db = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
  assert.equal((await db.auth.signInWithPassword(cred)).error, null);
  return { id: u.data.user.id, db };
};
const A = await mk(),
  B = await mk();
const prof = (id) =>
  sql(
    `select service_email||'|'||marketing_email||'|'||coalesce(marketing_version,'')||'|'||(marketing_at is not null) from profiles where id='${id}'`,
  );
const outbox = (id, purpose, status = "queued") =>
  Number(
    sql(
      `select count(*) from email_outbox where user_id='${id}' and purpose='${purpose}' and status='${status}'`,
    ),
  );

// Defaults: service on, marketing off, no version/time.
assert.equal(prof(A.id), "true|false||false", "marketing defaults off");

// Direct writes denied (columns not granted, tables closed).
await A.db
  .from("profiles")
  .update({ marketing_email: true, marketing_version: "forged" })
  .eq("id", A.id);
assert.equal(
  prof(A.id),
  "true|false||false",
  "direct column update has no effect",
);
assert.ok(
  (
    await A.db
      .from("consent_log")
      .insert({ user_id: A.id, purpose: "marketing_email", value: true })
  ).error,
);
assert.deepEqual((await A.db.from("email_outbox").select("*")).data ?? [], []);
assert.ok(
  (await A.db.rpc("enqueue_marketing", { p_key: "x" })).error,
  "users cannot trigger a marketing send",
);
assert.ok(
  (
    await createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      opts,
    ).rpc("set_preferences", {
      p_service: true,
      p_marketing: true,
      p_interests: [],
    })
  ).error,
  "anon denied",
);

// Opt in with interests: version + time set by server, one log row per changed purpose.
assert.equal(
  (
    await A.db.rpc("set_preferences", {
      p_service: true,
      p_marketing: true,
      p_interests: ["뷰티"],
    })
  ).error,
  null,
);
assert.equal(prof(A.id), "true|true|marketing-2026-11|true");
const log = (
  await A.db.from("consent_log").select("purpose,value,version").order("id")
).data;
assert.deepEqual(
  log.map((r) => r.purpose),
  ["marketing_email", "interests"],
);
assert.equal(log[0].version, "marketing-2026-11");
assert.deepEqual(
  (await B.db.from("consent_log").select("*").eq("user_id", A.id)).data,
  [],
  "others cannot read my log",
);
// Same values again: no new log rows.
await A.db.rpc("set_preferences", {
  p_service: true,
  p_marketing: true,
  p_interests: ["뷰티"],
});
assert.equal((await A.db.from("consent_log").select("id")).data.length, 2);

// Audience: only current consenters; interest filter.
const key = `t${Date.now()}`;
assert.equal((await svc.rpc("enqueue_marketing", { p_key: key })).error, null);
assert.equal(outbox(A.id, "marketing"), 1);
assert.equal(
  outbox(B.id, "marketing"),
  0,
  "non-consenting user never targeted",
);
await svc.rpc("enqueue_marketing", { p_key: key }); // resend is idempotent
assert.equal(outbox(A.id, "marketing"), 1);
await svc.rpc("enqueue_marketing", { p_key: key + "f", p_interest: "게임" });
assert.equal(outbox(A.id, "marketing"), 1, "interest filter excludes");

// Withdrawal cancels mail already waiting, and later sends exclude the user.
await A.db.rpc("set_preferences", {
  p_service: true,
  p_marketing: false,
  p_interests: ["뷰티"],
});
assert.equal(prof(A.id), "true|false||true");
assert.equal(outbox(A.id, "marketing"), 0);
assert.equal(
  outbox(A.id, "marketing", "cancelled"),
  1,
  "queued marketing mail cancelled on withdrawal",
);
await svc.rpc("enqueue_marketing", { p_key: key + "2" });
assert.equal(outbox(A.id, "marketing"), 0);

// Service email follows the notification trigger and its own switch only.
const pid = sql(`select id from proposals limit 1`);
const notify = () =>
  sql(
    `insert into notifications(user_id, proposal_id, kind, source_key) values ('${A.id}', '${pid}', 'status', 'qa:${crypto.randomUUID()}')`,
  );
notify();
assert.equal(
  outbox(A.id, "service"),
  1,
  "service email queued while on (marketing off doesn't matter)",
);
await A.db.rpc("set_preferences", {
  p_service: false,
  p_marketing: false,
  p_interests: [],
});
assert.equal(
  outbox(A.id, "service"),
  0,
  "turning service email off cancels queued",
);
notify();
assert.equal(outbox(A.id, "service"), 0, "no service email while off");
assert.equal(
  Number(sql(`select count(*) from notifications where user_id='${A.id}'`)),
  2,
  "in-app notifications still created",
);

for (const u of [A, B]) await svc.auth.admin.deleteUser(u.id);
assert.equal(
  Number(
    sql(
      `select count(*) from consent_log where user_id in ('${A.id}','${B.id}')`,
    ),
  ),
  0,
  "account deletion removes history",
);
console.log(
  "PASS: D015 consent — defaults (marketing off), direct writes denied, server version/time + log, audience = consenters, withdrawal cancels queued, service switch separate",
);
