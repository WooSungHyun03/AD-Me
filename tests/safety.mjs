// D062 direct DB checks on the isolated local Supabase: blocks apply to proposals, messages, acceptance and
// notifications through one helper; spam/multi-account limits; temporary admin-only restriction with appeal;
// accumulated reports never sanction automatically.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
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
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
const sql = (q) =>
  execFileSync("docker", [
    "exec",
    "supabase_db_AD-Me",
    "psql",
    "-U",
    "postgres",
    "-tAc",
    q,
  ])
    .toString()
    .trim();
const accounts = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const admin = client();
assert.equal(
  (
    await admin.auth.signInWithPassword({
      email: accounts.admin.email,
      password: accounts.admin.password,
    })
  ).error,
  null,
);
await elevateAdmin(admin, accounts.admin);
const err = (r) => r.error?.message ?? "";
const user = async (role) => {
  const db = client();
  const r = await db.auth.signUp({
    email: `adme-qa-d062-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role, name: `D062 ${role}` } },
  });
  assert.equal(r.error, null);
  const id = r.data.user.id;
  if (role === "creator") {
    const ins = await publishCreator(db, {
        name: "D062 크리에이터",
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
      });
    assert.equal(ins.error, null);
  }
  return { db, id, cid: `user-${id}` };
};
const campaign = async (b) =>
  (
    await b.db
      .from("campaigns")
      .insert({
        owner_id: b.id,
        status: "published",
        brief: {
          title: "D062",
          product: "QA",
          category: "뷰티",
          vibes: ["자연스러움"],
          format: "숏폼",
          platforms: ["youtube"],
          budget_krw: 100000,
          target_audience: "QA",
          goal: "안전 검증",
          status: "published",
        },
      })
      .select("id")
      .single()
  ).data.id;
// Requests are created through the same RPC as POST /api/proposals (direct inserts are not the contract).
const createRequest = async (db, campaign, creator, kind, brief) => {
  const r = await db.rpc("create_creator_proposal", {
    p_campaign: campaign,
    p_creator: creator,
    p_kind: kind,
    p_brief: brief,
  });
  return { ...r, data: r.data ? { id: r.data } : null };
};
const propose = (b, c, camp) =>
  createRequest(b.db, camp, c.cid, "proposal", "D062 안전 검증용 제안입니다.");
const say = (u, pid, body = "안녕하세요") =>
  u.db
    .from("messages")
    .insert({ proposal_id: pid, sender_id: u.id, kind: "message", body });
const unread = async (u) => (await u.db.rpc("notification_unread")).data;

// 1. Block from a shared proposal closes the open request and stops contact both ways.
const B = await user("brand"),
  C = await user("creator");
const pid = (await propose(B, C, await campaign(B))).data.id;
assert.equal((await say(B, pid)).error, null);
assert.equal((await say(C, pid)).error, null);
const bUnread = await unread(B);
assert.ok(
  (
    await C.db
      .from("user_blocks")
      .insert({ blocker_id: C.id, blocked_id: B.id })
  ).error,
  "no direct block insert",
);
assert.match(
  err(await B.db.rpc("block_counterparty", { p_proposal: randomUUID() })),
  /forbidden/,
);
const outsider = await user("brand");
assert.match(
  err(await outsider.db.rpc("block_counterparty", { p_proposal: pid })),
  /forbidden/,
  "non-participant cannot block",
);
assert.equal(
  (await C.db.rpc("block_counterparty", { p_proposal: pid })).data,
  "blocked",
);
assert.equal(
  (await C.db.from("proposals").select("status").eq("id", pid).single()).data
    .status,
  "rejected",
  "open request closed",
);
assert.equal(
  await unread(B),
  bUnread,
  "blocked user gets no notification (block not revealed)",
);
assert.equal(
  (await B.db.from("user_blocks").select("blocker_id")).data.length,
  0,
  "blocked user cannot see the block",
);
assert.equal((await C.db.rpc("my_blocks")).data[0].blocked_id, B.id);
assert.match(err(await say(B, pid)), /blocked/, "blocked sender refused");
assert.match(
  err(await say(C, pid)),
  /blocked/,
  "blocker cannot message either",
);
assert.match(
  err(await propose(B, C, await campaign(B))),
  /blocked/,
  "new proposal refused",
);
// The helper is internal: no probing other people's relations.
assert.ok(
  (await B.db.rpc("contact_denied", { p_sender: C.id, p_recipient: B.id }))
    .error,
  "contact_denied not callable",
);
assert.ok(
  (await outsider.db.rpc("contact_restricted", { p_user: C.id })).error,
  "contact_restricted not callable",
);
// 2. Block after a request: acceptance refused through the same helper.
const B2 = await user("brand");
const pid2 = (await propose(B2, C, await campaign(B2))).data.id;
sql(
  `insert into user_blocks(blocker_id, blocked_id) values ('${B2.id}', '${C.id}')`,
); // B2 blocks without closing
assert.match(
  err(
    await C.db.rpc("transition_proposal", { p_id: pid2, p_action: "accepted" }),
  ),
  /blocked/,
  "cannot accept blocked",
);
assert.equal(
  (await C.db.rpc("transition_proposal", { p_id: pid2, p_action: "rejected" }))
    .data,
  "rejected",
  "can still decline",
);
// 3. Unblock: only the blocker; contact resumes.
assert.match(
  err(await B.db.rpc("unblock_user", { p_user: C.id })),
  /not_found/,
);
assert.equal(
  (await C.db.rpc("unblock_user", { p_user: B.id })).data,
  "unblocked",
);
assert.equal(
  (await propose(B, C, await campaign(B))).error,
  null,
  "contact resumes after unblock",
);

// 4. Spam limits. Sender: 30 messages / 10 min.
const B3 = await user("brand"),
  C3 = await user("creator");
const pid3 = (await propose(B3, C3, await campaign(B3))).data.id;
// The platform-wide message quota (20/min, PT429) applies first; the D062 sender cap (30/10 min)
// is reached across two minute windows.
for (let i = 0; i < 20; i++)
  assert.equal((await say(B3, pid3, `m${i}`)).error, null);
assert.match(err(await say(B3, pid3, "21")), /request limit reached/);
await new Promise((r) => setTimeout(r, 61_000 - (Date.now() % 60_000)));
for (let i = 20; i < 30; i++)
  assert.equal((await say(B3, pid3, `m${i}`)).error, null);
assert.match(err(await say(B3, pid3, "31")), /rate_limited/);
assert.equal((await say(C3, pid3, "답장")).error, null, "limit is per sender");
// Recipient: 10 new requests / hour from any number of accounts (multi-account).
const C4 = await user("creator");
for (let i = 0; i < 10; i++) {
  const b = await user("brand");
  assert.equal((await propose(b, C4, await campaign(b))).error, null);
}
const b11 = await user("brand");
assert.match(
  err(await propose(b11, C4, await campaign(b11))),
  /rate_limited/,
  "multi-account flood refused",
);
// Applications to one brand's open campaigns are not capped per hour (popular campaigns get many).
const popular = await user("brand"),
  C6 = await user("creator");
for (let i = 0; i < 11; i++) {
  const camp = await campaign(popular);
  assert.equal(
    (
      await createRequest(C6.db, camp, C6.cid, "application", "인기 캠페인 지원 검증입니다.")
    ).error,
    null,
    `application to popular brand ${i}`,
  );
}
// Sender: 20 new requests / 24h (applications across 3 brands so no recipient hits its own limit).
const C5 = await user("creator");
const owners = [await user("brand"), await user("brand"), await user("brand")];
const camps = [];
for (let i = 0; i < 21; i++)
  camps.push([owners[i % 3], await campaign(owners[i % 3])]);
const apply = ([o, camp]) =>
  createRequest(C5.db, camp, C5.cid, "application", "D062 지원 속도 제한 검증입니다.");
for (let i = 0; i < 20; i++)
  assert.equal((await apply(camps[i])).error, null, `application ${i}`);
assert.match(err(await apply(camps[20])), /rate_limited/);

// 5. Accumulated reports do not sanction automatically.
const T = await user("creator");
for (let i = 0; i < 5; i++) {
  const r = await user("brand");
  assert.equal(
    (
      await r.db.rpc("submit_report", {
        p_kind: i % 2 ? "impersonation" : "report",
        p_creator: T.cid,
        p_reason: "D062 누적 신고 검증용 사유입니다.",
        p_source_url: "https://example.com/d062",
      })
    ).error,
    null,
  );
}
assert.equal(
  sql(`select count(*) from contact_restrictions where user_id='${T.id}'`),
  "0",
  "no automatic restriction",
);
assert.equal(
  sql(`select published from creators where id='${T.cid}'`),
  "t",
  "no automatic hiding",
);
const BT = await user("brand");
assert.equal(
  (await propose(BT, T, await campaign(BT))).error,
  null,
  "reported user still reachable until a human decides",
);

// 6. Human, temporary restriction with appeal.
const rep = (
  await B.db.rpc("submit_report", {
    p_kind: "impersonation",
    p_creator: C.cid,
    p_reason: "다른 크리에이터를 사칭하는 것으로 보입니다.",
    p_source_url: "https://example.com/real",
  })
).data[0];
assert.match(
  err(
    await B.db.rpc("restrict_contact", {
      p_report: rep.id,
      p_days: 7,
      p_reason: "사칭 확인",
    }),
  ),
  /forbidden/,
  "non-admin cannot restrict",
);
assert.match(
  err(
    await admin.rpc("restrict_contact", {
      p_report: rep.id,
      p_days: 31,
      p_reason: "사칭 확인",
    }),
  ),
  /invalid_days/,
  "no >30 day / permanent",
);
const demoRep = (
  await B.db.rpc("submit_report", {
    p_kind: "report",
    p_creator: "creator-020",
    p_reason: "수집 프로필 제한 불가 검증입니다.",
    p_source_url: "https://example.com/x",
  })
).data[0];
assert.match(
  err(
    await admin.rpc("restrict_contact", {
      p_report: demoRep.id,
      p_days: 7,
      p_reason: "계정 없음",
    }),
  ),
  /no_account/,
);
const rid = (
  await admin.rpc("restrict_contact", {
    p_report: rep.id,
    p_days: 7,
    p_reason: "사칭 확인 후 7일 연락 제한",
  })
).data;
assert.match(
  err(await say(C, pid3)),
  /forbidden|row-level|insufficient_privilege|blocked|contact_restricted/,
); // not a participant of pid3
const pidC = (
  await C.db
    .from("proposals")
    .select("id,status")
    .eq("brand_id", B.id)
    .eq("status", "pending")
    .limit(1)
    .single()
).data.id;
assert.match(
  err(await say(C, pidC)),
  /contact_restricted/,
  "restricted user cannot message",
);
const Bx = await user("brand");
const campX = await campaign(Bx);
assert.match(
  err(
    await createRequest(C.db, campX, C.cid, "application", "제한 중 지원 시도입니다."),
  ),
  /contact_restricted/,
);
assert.equal(
  (await C.db.from("contact_restrictions").select("id")).data.length,
  1,
  "restricted user sees own restriction",
);
assert.equal(
  (await B.db.from("contact_restrictions").select("id").eq("user_id", C.id))
    .data.length,
  0,
  "others cannot see it",
);
assert.ok(
  (
    await C.db
      .from("contact_restrictions")
      .update({ ends_at: new Date().toISOString() })
      .eq("id", rid)
  ).error,
  "cannot shorten own restriction",
);
assert.match(
  err(
    await B.db.rpc("appeal_restriction", {
      p_id: rid,
      p_text: "제3자가 대신 이의신청합니다.",
    }),
  ),
  /appeal_closed/,
);
assert.equal(
  (
    await C.db.rpc("appeal_restriction", {
      p_id: rid,
      p_text: "본인 채널 링크로 본인임을 증명할 수 있습니다.",
    })
  ).data,
  "appealed",
);
assert.match(
  err(
    await C.db.rpc("appeal_restriction", {
      p_id: rid,
      p_text: "두 번째 이의신청을 시도합니다.",
    }),
  ),
  /appeal_closed/,
);
assert.match(
  err(await C.db.rpc("lift_restriction", { p_id: rid })),
  /forbidden/,
);
assert.equal(
  (await admin.rpc("lift_restriction", { p_id: rid })).data,
  "lifted",
);
assert.equal((await say(C, pidC)).error, null, "contact resumes after lift");
assert.ok(
  Number(sql(`select count(*) from audit_log where entity_id='${rid}'`)) >= 2,
  "restriction audited",
);
// Expired restriction stops applying by itself.
const rid2 = (
  await admin.rpc("restrict_contact", {
    p_report: rep.id,
    p_days: 1,
    p_reason: "만료 확인용 제한",
  })
).data;
sql(
  `update contact_restrictions set starts_at = now() - interval '2 days', ends_at = now() - interval '1 day' where id='${rid2}'`,
);
assert.equal(
  (await say(C, pidC, "만료 후")).error,
  null,
  "expired restriction no longer applies",
);
console.log(
  "PASS: D062 safety — block closes requests & stops messages/proposals/accept/notifications, no probing, sender/recipient(multi-account)/application limits, no auto-sanction, temporary admin restriction + appeal + lift",
);
