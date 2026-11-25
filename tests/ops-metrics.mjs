// D063 direct REST: metrics are admin-only counts that exclude reserved-domain test accounts and demo data;
// error counts carry no PII; inquiries are written server-side only, rate limited, readable by owner/admin.
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
const brand = await as(a.brand),
  creator = await as(a.creator),
  admin = await elevateAdmin(await as(a.admin), a.admin),
  anon = await as();
const metrics = async () =>
  (await admin.rpc("ops_metrics", { p_days: 7 })).data;

// The rule itself.
for (const [e, t] of [
  ["x@example.com", true],
  ["x@qa.example.org", true],
  ["x@foo.test", true],
  ["x@a.invalid", true],
  ["x@gmail.com", false],
  ["x@example.co.kr", false],
  ["x@notexample.com", false],
])
  assert.equal(sql(`select is_test_email('${e}')`), t ? "t" : "f", e);

// Permissions.
for (const db of [brand, creator, anon]) {
  assert.ok(
    (await db.rpc("ops_metrics", { p_days: 7 })).error,
    "metrics admin only",
  );
  assert.ok(
    (await db.rpc("record_error", { p_route: "/x", p_kind: "render" })).error,
    "record_error service only",
  );
  assert.ok(
    (
      await db.rpc("submit_inquiry", {
        p_user: null,
        p_email: "a@b.kr",
        p_category: "usage",
        p_message: "직접 호출 시도입니다.",
      })
    ).error,
  );
  assert.ok(
    (
      await db.from("inquiries").insert({
        category: "usage",
        message: "직접 insert 시도입니다.",
        reply_email: "a@b.kr",
      })
    ).error,
  );
  assert.deepEqual((await db.from("ops_errors").select("*")).data ?? [], []);
}
assert.ok(
  (await admin.from("ops_errors").select("*")).error ||
    (await admin.from("ops_errors").select("*")).data.length === 0,
  "raw table not exposed",
);

const before = await metrics();
const stamp = Date.now();
// A non-reserved-domain account counts; the reserved-domain one does not.
const realEmail = `ops-real-${stamp}@adme-ops-check.kr`;
const real = (
  await svc.auth.admin.createUser({
    email: realEmail,
    password: "Ops-Real-2026!",
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role: "brand", name: "실계정 검증" },
  })
).data.user;
const fake = (
  await svc.auth.admin.createUser({
    email: `ops-fake-${stamp}@example.com`,
    password: "Ops-Fake-2026!",
    email_confirm: true,
    user_metadata: { ...qaSignupConsent, role: "brand", name: "테스트" },
  })
).data.user;
const brief = sql(
  `select brief::text from campaigns where not is_demo limit 1`,
).replace(/'/g, "''");
try {
  sql(
    `insert into campaigns(owner_id, brief, status) values ('${real.id}', '${brief}', 'draft'), ('${fake.id}', '${brief}', 'draft')`,
  );
  // Inquiries: through the service function only.
  const q1 = await svc.rpc("submit_inquiry", {
    p_user: real.id,
    p_email: "",
    p_category: "usage",
    p_message: "실계정의 이용 문의입니다.",
  });
  assert.equal(q1.error, null);
  await svc.rpc("submit_inquiry", {
    p_user: fake.id,
    p_email: "",
    p_category: "usage",
    p_message: "테스트 계정의 문의입니다.",
  });
  await svc.rpc("submit_inquiry", {
    p_user: null,
    p_email: `anon-${stamp}@foo.test`,
    p_category: "other",
    p_message: "테스트 도메인 비회원 문의.",
  });
  assert.ok(
    (
      await svc.rpc("submit_inquiry", {
        p_user: null,
        p_email: null,
        p_category: "usage",
        p_message: "답변 이메일 없는 비회원.",
      })
    ).error,
    "anon needs reply email",
  );
  for (let i = 0; i < 4; i++)
    await svc.rpc("submit_inquiry", {
      p_user: fake.id,
      p_email: "",
      p_category: "usage",
      p_message: `한도 확인용 문의 ${i}번입니다.`,
    });
  assert.match(
    (
      await svc.rpc("submit_inquiry", {
        p_user: fake.id,
        p_email: "",
        p_category: "usage",
        p_message: "여섯 번째 문의입니다.",
      })
    ).error?.message ?? "",
    /rate_limited/,
  );
  // Errors: sanitized route, no message stored.
  await svc.rpc("record_error", {
    p_route: "/campaigns/[id]",
    p_kind: "render",
  });
  await svc.rpc("record_error", {
    p_route: `/x?email=${realEmail}`,
    p_kind: "Bad Kind!",
  });
  assert.equal(
    sql(
      `select count(*) from ops_errors where route like '%@%' or route like '%?%'`,
    ),
    "0",
    "no PII/query in routes",
  );
  assert.equal(
    sql(
      `select count(*) from ops_errors where route = '/other' and kind = 'other'`,
    ) >= "1",
    true,
  );

  const after = await metrics();
  assert.equal(
    after.activity.signups - before.activity.signups,
    1,
    "only the real account counts as a signup",
  );
  assert.equal(
    after.activity.campaigns_created - before.activity.campaigns_created,
    1,
    "test account's campaign excluded",
  );
  assert.equal(
    after.inquiries.received - before.inquiries.received,
    1,
    "test-account / test-domain inquiries excluded",
  );
  assert.equal(after.errors.total - before.errors.total, 2);
  assert.equal(after.excluded.test_accounts - before.excluded.test_accounts, 1);
  assert.ok(after.excluded.demo_campaigns >= 8);
  assert.ok(!JSON.stringify(after).includes("@"), "aggregate has no emails");
  assert.equal(after.period.days, 7);
  assert.equal(
    (await admin.rpc("ops_metrics", { p_days: 999 })).data.period.days,
    90,
    "period clamped",
  );

  // Answering: admin only; owner reads own; others read nothing.
  const qid = q1.data;
  assert.ok(
    (
      await brand.rpc("answer_inquiry", {
        p_id: qid,
        p_answer: "x",
        p_close: false,
      })
    ).error,
  );
  assert.equal(
    (
      await admin.rpc("answer_inquiry", {
        p_id: qid,
        p_answer: "도움말 화면을 참고하세요.",
        p_close: false,
      })
    ).error,
    null,
  );
  const realDb = await as({ email: realEmail, password: "Ops-Real-2026!" });
  assert.equal(
    (await realDb.from("inquiries").select("answer").eq("id", qid)).data[0]
      .answer,
    "도움말 화면을 참고하세요.",
  );
  for (const db of [brand, creator, anon])
    assert.deepEqual(
      (await db.from("inquiries").select("id").eq("id", qid)).data ?? [],
      [],
    );
  assert.equal(
    (await admin.from("inquiries").select("id").eq("id", qid)).data.length,
    1,
  );
  assert.equal(
    (await metrics()).inquiries.answered - before.inquiries.answered,
    1,
  );
  assert.equal(
    sql(
      `select count(*) from audit_log where entity_id = '${qid}' and action = 'inquiry:answered'`,
    ),
    "1",
  );
} finally {
  sql(`delete from inquiries where user_id in ('${real.id}', '${fake.id}') or reply_email like '%-${stamp}@%';
       delete from campaigns where owner_id in ('${real.id}', '${fake.id}');
       update ops_errors set n = n - 1 where (route, kind) in (('/campaigns/[id]', 'render'), ('/other', 'other')) and day = (now() at time zone 'Asia/Seoul')::date;
       delete from ops_errors where n <= 0`);
  await svc.auth.admin.deleteUser(real.id);
  await svc.auth.admin.deleteUser(fake.id);
}
console.log(
  "PASS: D063 ops metrics — admin-only counts, reserved-domain test accounts + demo excluded, PII-free error counts, inquiries server-only with limits, owner/admin read, admin answer audited",
);
