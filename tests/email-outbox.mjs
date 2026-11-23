// D053 direct REST: outbox idempotency, skip-locked claims, backoff + dead-letter, consent re-check at send
// time, lease recovery, one-click unsubscribe tokens, and that no client role can touch any of it.
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
const brand = await as(a.brand),
  admin = await as(a.admin),
  anon = await as();
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const tag = `t${Date.now()}`;
const prefs = sql(
  `select service_email || ',' || marketing_email from profiles where id = '${a.creator.id}'`,
);
// Park rows other tests left due, so claims here only see this test's rows.
const parked = sql(
  `update email_outbox set next_attempt_at = next_attempt_at + interval '100 years' where status in ('queued','failed','sending') returning id`,
)
  .split("\n")
  .filter(Boolean);
let seq = 0;
const q = (n, purpose = "service", user = a.creator.id) =>
  sql(
    `insert into email_outbox(user_id, purpose, source_key, template) select '${user}', '${purpose}', '${tag}:${++seq}:' || g, 'notification_status' from generate_series(1, ${n}) g returning id`,
  )
    .split("\n")
    .map(Number);
const status = (id) => sql(`select status from email_outbox where id = ${id}`);

try {
  // No client access at all.
  for (const db of [anon, brand]) {
    assert.ok((await db.rpc("claim_emails", { p_limit: 5 })).error);
    assert.ok((await db.rpc("finish_email", { p_id: 1, p_ok: true })).error);
    assert.ok(
      (
        await db.rpc("unsubscribe_token", {
          p_user: a.brand.id,
          p_purpose: "marketing",
        })
      ).error,
    );
    assert.deepEqual(
      (await db.from("email_outbox").select("id")).data ?? [],
      [],
    );
    assert.deepEqual(
      (await db.from("email_secret").select("*")).data ?? [],
      [],
    );
  }
  assert.ok((await brand.rpc("email_outbox_stats")).error);
  assert.equal((await admin.rpc("email_outbox_stats")).error, null);

  // Idempotency: event + recipient + channel.
  sql(`update profiles set service_email = true where id = '${a.creator.id}'`);
  assert.throws(() =>
    sql(
      `insert into email_outbox(user_id, purpose, source_key) values ('${a.creator.id}', 'service', '${tag}:dup'), ('${a.creator.id}', 'service', '${tag}:dup')`,
    ),
  );
  // Notification trigger enqueues once, with the versioned template.
  const pid = sql(
    `select id from proposals where creator_user_id = '${a.creator.id}' limit 1`,
  );
  assert.ok(pid, "fixture: creator has a proposal");
  {
    const nid = sql(
      `insert into notifications(user_id, proposal_id, kind, source_key) values ('${a.creator.id}', '${pid}', 'message', '${tag}:n') returning id`,
    ).split("\n")[0];
    assert.equal(
      sql(
        `select count(*) || template || template_version from email_outbox where source_key = 'notification:${nid}' group by template, template_version`,
      ),
      "1notification_messagev1",
    );
    sql(
      `update email_outbox set next_attempt_at = now() + interval '100 years' where source_key = 'notification:${nid}'`,
    );
  }

  // Parallel claims never hand out the same row.
  const ids = q(6);
  const [c1, c2] = await Promise.all([
    svc.rpc("claim_emails", { p_limit: 4 }),
    svc.rpc("claim_emails", { p_limit: 4 }),
  ]);
  const got = [...c1.data, ...c2.data].map((r) => r.id);
  assert.equal(new Set(got).size, got.length, "no row claimed twice");
  assert.deepEqual(got.sort(), [...ids].sort(), "all due rows claimed");
  const r0 = c1.data[0] ?? c2.data[0];
  assert.match(r0.email, /@/);
  assert.match(
    r0.unsubscribe,
    new RegExp(`^${a.creator.id}\\.service\\.[0-9a-f]{40}$`),
  );
  for (const id of ids.slice(1))
    await svc.rpc("finish_email", { p_id: id, p_ok: true });
  assert.equal(status(ids[1]), "sent");
  assert.equal(
    (await svc.rpc("finish_email", { p_id: ids[1], p_ok: false })).data,
    null,
    "a finished row cannot be re-finished",
  );

  // Failure → backoff → after 5 attempts dead-lettered.
  const f = ids[0];
  for (let i = 1; i <= 5; i++) {
    if (i > 1) {
      sql(`update email_outbox set next_attempt_at = now() where id = ${f}`);
      assert.equal(
        (await svc.rpc("claim_emails", { p_limit: 5 })).data.length,
        1,
      );
    }
    const s = (
      await svc.rpc("finish_email", {
        p_id: f,
        p_ok: false,
        p_error: "smtp_421",
      })
    ).data;
    assert.equal(s, i < 5 ? "failed" : "dead");
    if (i === 1)
      assert.ok(
        Number(
          sql(
            `select extract(epoch from next_attempt_at - now()) from email_outbox where id = ${f}`,
          ),
        ) > 60,
        "backoff",
      );
  }
  sql(`update email_outbox set next_attempt_at = now() where id = ${f}`);
  assert.equal(
    (await svc.rpc("claim_emails", { p_limit: 5 })).data.length,
    0,
    "dead rows are not retried",
  );

  // Lease: a 'sending' row from a crashed worker becomes claimable after its lease.
  const [l] = q(1);
  await svc.rpc("claim_emails", { p_limit: 5 });
  assert.equal(
    (await svc.rpc("claim_emails", { p_limit: 5 })).data.length,
    0,
    "leased row is held",
  );
  sql(
    `update email_outbox set locked_until = now() - interval '1 second' where id = ${l}`,
  );
  const re = (await svc.rpc("claim_emails", { p_limit: 5 })).data;
  assert.equal(re.length, 1);
  assert.equal(re[0].attempts, 2);
  await svc.rpc("finish_email", { p_id: l, p_ok: true });

  // Consent withdrawn after enqueue → cancelled at claim time, never handed to the sender.
  const [w] = q(1);
  sql(`update profiles set service_email = false where id = '${a.creator.id}'`);
  assert.equal((await svc.rpc("claim_emails", { p_limit: 5 })).data.length, 0);
  assert.equal(status(w), "cancelled");
  sql(`update profiles set service_email = true where id = '${a.creator.id}'`);

  // Unsubscribe link: valid → off + consent log + queued cancelled; forged/other-user/malformed → refused.
  sql(
    `update profiles set marketing_email = true, marketing_version = 'marketing-2026-11', marketing_at = now() where id = '${a.creator.id}'`,
  );
  const [m] = q(1, "marketing");
  const token = (
    await svc.rpc("unsubscribe_token", {
      p_user: a.creator.id,
      p_purpose: "marketing",
    })
  ).data;
  const forged = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
  const otherUser = a.brand.id + token.slice(36);
  for (const bad of [
    forged,
    otherUser,
    "x",
    token.replace(".marketing.", ".service."),
  ])
    assert.ok(
      (await anon.rpc("unsubscribe_email", { p_token: bad })).error,
      `refused: ${bad.slice(-6)}`,
    );
  assert.equal(
    sql(`select marketing_email from profiles where id = '${a.creator.id}'`),
    "t",
  );
  assert.equal(
    (await anon.rpc("unsubscribe_email", { p_token: token })).data,
    "marketing",
  );
  assert.equal(
    sql(
      `select marketing_email::text || coalesce(marketing_version, '-') from profiles where id = '${a.creator.id}'`,
    ),
    "false-",
  );
  assert.equal(status(m), "cancelled");
  assert.equal(
    sql(
      `select version from consent_log where user_id = '${a.creator.id}' and purpose = 'marketing_email' order by id desc limit 1`,
    ),
    "unsubscribe-link",
  );
  assert.equal(
    (await anon.rpc("unsubscribe_email", { p_token: token })).error,
    null,
    "repeat click is harmless",
  );
} finally {
  sql(`delete from email_outbox where source_key like '${tag}:%';
       ${parked.length ? `update email_outbox set next_attempt_at = next_attempt_at - interval '100 years' where id in (${parked.join(",")});` : ""}
       update profiles set service_email = ${prefs.split(",")[0] === "t"}, marketing_email = ${prefs.split(",")[1] === "t"} where id = '${a.creator.id}'`);
}
console.log(
  "PASS: D053 outbox — client roles denied, event+recipient+channel unique, trigger template v1, skip-locked claims, backoff→dead after 5, lease recovery, consent re-check at send, unsubscribe token (forged/other-user refused, consent log, queue cancelled)",
);
