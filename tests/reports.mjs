// D058 direct DB checks on the isolated local Supabase: request queue (ticket, deadline, interim action,
// answer, appeal, log), requester-only visibility, abuse limits, and no re-collection after deletion.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
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
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
// Collector path = database owner (no RLS), standing in for a future ingestion writer.
const psql = (sql) =>
  execFileSync(
    "docker",
    [
      "exec",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-tAc",
      sql,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
const psqlErr = (sql) => {
  try {
    psql(sql);
    return "";
  } catch (e) {
    return String(e.stderr);
  }
};
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const login = async (acc) => {
  const db = client();
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const signup = async (role = "brand") => {
  const db = client();
  const r = await db.auth.signUp({
    email: `adme-qa-d058-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role, name: "D058" } },
  });
  assert.equal(r.error, null);
  return { db, uid: r.data.user.id };
};
const admin = await login(a.admin);
const err = (r) => r.error?.message ?? "";
const submit = (db, o) =>
  db.rpc("submit_report", {
    p_kind: o.kind,
    p_creator: o.creator ?? "",
    p_reason: o.reason ?? "검토가 필요한 내용입니다. 확인 부탁드립니다.",
    p_source_url: o.url ?? null,
    p_parent: o.parent ?? null,
  });
const review = (db, id, status, response, hide) =>
  db.rpc("review_report", {
    p_id: id,
    p_status: status,
    p_response: response ?? null,
    p_hide: hide ?? null,
  });

// A collected (ownerless, non-demo) profile written by the collector path.
const cid = `qa-collected-${randomUUID().slice(0, 8)}`,
  handle = `qa_handle_${randomUUID().slice(0, 6)}`;
const profile = (name) =>
  JSON.stringify({
    name,
    bio: "",
    handle,
    categories: ["뷰티"],
    vibes: [],
    formats: [],
    platforms: ["youtube"],
    price_min_krw: null,
    price_max_krw: null,
    followers: 0,
    is_available: null,
    is_demo: false,
    social_url: `https://example.com/${handle}/`,
  });
psql(
  `insert into creators(id, owner_id, published, profile) values ('${cid}', null, true, '${profile("수집 프로필")}'::jsonb)`,
);

// 1. Anonymous and malformed requests are refused; direct writes are closed.
assert.match(
  err(
    await submit(client(), {
      kind: "report",
      creator: cid,
      url: "https://example.com/a",
    }),
  ),
  /forbidden|permission denied/,
);
const A = await signup();
assert.match(
  err(await submit(A.db, { kind: "report", creator: cid })),
  /invalid_source/,
);
assert.match(
  err(
    await submit(A.db, {
      kind: "report",
      creator: cid,
      url: "https://e.com",
      reason: "짧음",
    }),
  ),
  /invalid_reason/,
);
assert.match(
  err(await submit(A.db, { kind: "hack", creator: cid })),
  /invalid_kind/,
);
assert.match(
  err(
    await submit(A.db, {
      kind: "report",
      creator: "no-such-creator",
      url: "https://e.com/x",
    }),
  ),
  /not_found/,
);
assert.ok(
  (
    await A.db.from("reports").insert({
      reporter_id: A.uid,
      creator_id: cid,
      reason: "직접 삽입 시도입니다.",
      source_url: "https://e.com",
    })
  ).error,
);

// 2. Ticket, deadline (deletion 10 days, others 7), third-party not identity-verified, duplicate open refused.
const del = (
  await submit(A.db, {
    kind: "deletion",
    creator: cid,
    reason: "제 채널이 동의 없이 수집되었습니다. 삭제해주세요.",
  })
).data[0];
assert.match(del.ticket_no, /^ADR-\d{6}-\d{5}$/);
const days = (iso) => Math.round((new Date(iso) - Date.now()) / 864e5);
assert.equal(days(del.due_at), 10);
assert.match(
  err(await submit(A.db, { kind: "deletion", creator: cid })),
  /duplicate_open/,
);
const corr = (
  await submit(A.db, {
    kind: "correction",
    creator: "creator-002",
    url: "https://example.com/c",
  })
).data[0];
assert.equal(days(corr.due_at), 7);
assert.equal(
  (
    await A.db
      .from("reports")
      .select("identity_verified")
      .eq("id", del.id)
      .single()
  ).data.identity_verified,
  false,
);

// 3. Abuse limit: 5 requests per 24h per account.
for (const c of ["creator-003", "creator-004", "creator-005"])
  assert.equal(
    (
      await submit(A.db, {
        kind: "correction",
        creator: c,
        url: "https://example.com/c",
      })
    ).error,
    null,
  );
assert.match(
  err(
    await submit(A.db, {
      kind: "correction",
      creator: "creator-006",
      url: "https://example.com/c",
    }),
  ),
  /rate_limited/,
);

// 4. Requester-only visibility: other users and anonymous see nothing; requester cannot change status.
const B = await signup();
assert.equal(
  (await B.db.from("reports").select("id").eq("id", del.id)).data.length,
  0,
);
assert.equal(
  (await B.db.from("report_events").select("id").eq("report_id", del.id)).data
    .length,
  0,
);
assert.equal(
  (await client().from("reports").select("id")).data?.length ?? 0,
  0,
);
assert.equal(
  (
    await A.db
      .from("reports")
      .update({ status: "resolved" })
      .eq("id", del.id)
      .select()
  ).data?.length ?? 0,
  0,
);
assert.ok(
  (
    await A.db
      .from("report_events")
      .insert({ report_id: del.id, to_status: "resolved" })
  ).error,
);
assert.match(
  err(await review(A.db, del.id, "resolved", "스스로 처리")),
  /forbidden/,
);
assert.equal(
  (await A.db.from("suppressed_sources").select("match_key")).data.length,
  0,
  "suppression list is admin-only",
);

// 5. Admin flow: interim hide, transitions, answer required, deletion → scrub + suppression.
assert.equal(
  (await review(admin, del.id, "in_review", null, true)).error,
  null,
);
assert.equal(
  psql(
    `select published::text || ',' || moderation_locked::text from creators where id='${cid}'`,
  ),
  "false,true",
);
assert.equal(
  (await client().from("creators").select("id").eq("id", cid)).data.length,
  0,
  "hidden profile not public",
);
assert.match(err(await review(admin, del.id, "resolved")), /response_required/);
assert.equal(
  (
    await review(
      admin,
      del.id,
      "resolved",
      "확인 결과 동의 없는 수집이라 삭제했습니다.",
    )
  ).error,
  null,
);
assert.match(
  err(await review(admin, del.id, "in_review")),
  /invalid_transition/,
  "closed request cannot reopen",
);
const mine = (
  await A.db
    .from("reports")
    .select("status,response,interim_hidden")
    .eq("id", del.id)
    .single()
).data;
assert.deepEqual([mine.status, mine.interim_hidden], ["resolved", true]);
assert.match(mine.response, /삭제했습니다/);
assert.deepEqual(
  (
    await A.db
      .from("report_events")
      .select("to_status")
      .eq("report_id", del.id)
      .order("id")
  ).data.map((e) => e.to_status),
  ["pending", "in_review", "resolved"],
);
assert.equal(
  psql(
    `select profile->>'name' || ',' || coalesce(profile->>'handle','') from creators where id='${cid}'`,
  ),
  "삭제된 프로필,",
);
assert.ok(
  Number(psql(`select count(*) from audit_log where entity_id='${del.id}'`)) >=
    2,
);

// 6. Re-collection is blocked: same id, same handle under a new id, same URL, or republishing.
assert.match(
  psqlErr(
    `insert into creators(id, owner_id, published, profile) values ('${cid}-2', null, true, '${profile("다시 수집")}'::jsonb)`,
  ),
  /suppressed_source/,
);
assert.match(
  psqlErr(
    `insert into creators(id, owner_id, published, profile) values ('${cid}-3', null, true, '${JSON.stringify({ ...JSON.parse(profile("URL만 같음")), handle: "other_handle" })}'::jsonb)`,
  ),
  /suppressed_source/,
);
assert.match(
  psqlErr(`update creators set published = true where id='${cid}'`),
  /suppressed_source/,
);
assert.match(
  err(
    await admin.rpc("moderate_entity", {
      p_kind: "creator",
      p_id: cid,
      p_published: true,
    }),
  ),
  /suppressed_source/,
);
assert.equal(
  psqlErr(
    `insert into creators(id, owner_id, published, profile) values ('qa-unrelated-${randomUUID().slice(0, 6)}', null, false, '${JSON.stringify({ ...JSON.parse(profile("무관")), handle: "unrelated_h", social_url: "" })}'::jsonb)`,
  ),
  "",
  "unrelated profiles are unaffected",
);

// 7. Appeal: only the requester, once, decided by a different admin.
assert.match(
  err(await submit(B.db, { kind: "appeal", parent: del.id })),
  /forbidden/,
);
const ap = await submit(A.db, {
  kind: "appeal",
  parent: del.id,
  reason: "처리 결과에 대해 다시 검토를 요청합니다.",
});
// A hit its daily limit above; appeals count too.
assert.match(err(ap), /rate_limited/);
const C = await signup();
const r2 = (
  await submit(C.db, {
    kind: "report",
    creator: "creator-007",
    url: "https://example.com/r",
  })
).data[0];
assert.match(
  err(
    await submit(C.db, {
      kind: "appeal",
      parent: r2.id,
      reason: "결정 전 재심 요청입니다.",
    }),
  ),
  /appeal_closed/,
  "no appeal before a decision",
);
assert.equal(
  (await review(admin, r2.id, "dismissed", "확인 결과 문제가 없습니다.")).error,
  null,
);
const appeal = (
  await submit(C.db, {
    kind: "appeal",
    parent: r2.id,
    reason: "근거를 보강해 재심을 요청합니다.",
  })
).data[0];
assert.match(
  err(
    await submit(C.db, {
      kind: "appeal",
      parent: r2.id,
      reason: "두 번째 재심 요청입니다.",
    }),
  ),
  /duplicate_open/,
);
assert.match(
  err(
    await submit(C.db, {
      kind: "appeal",
      parent: appeal.id,
      reason: "재심의 재심 요청입니다.",
    }),
  ),
  /forbidden/,
);
assert.match(
  err(await review(admin, appeal.id, "resolved", "같은 관리자 처리")),
  /same_reviewer/,
);
const second = await signup();
psql(`update profiles set role='admin' where id='${second.uid}'`);
assert.equal(
  (
    await review(
      second.db,
      appeal.id,
      "resolved",
      "재심 결과 원 판단을 유지합니다.",
    )
  ).error,
  null,
);
assert.equal(
  (
    await C.db
      .from("reports")
      .select("kind,status,parent_id")
      .eq("id", appeal.id)
      .single()
  ).data.parent_id,
  r2.id,
);

// 8. Profile owner's deletion request is identity-verified by the DB.
const O = await signup("creator");
const oid = `user-${O.uid}`;
assert.equal(
  (
    await O.db.from("creators").insert({
      id: oid,
      owner_id: O.uid,
      published: true,
      profile: JSON.parse(profile("본인 프로필")),
    })
  ).error,
  null,
);
const own = (
  await submit(O.db, {
    kind: "deletion",
    creator: oid,
    reason: "제 프로필을 삭제하고 싶습니다. 처리 부탁드립니다.",
  })
).data[0];
assert.equal(
  (
    await O.db
      .from("reports")
      .select("identity_verified")
      .eq("id", own.id)
      .single()
  ).data.identity_verified,
  true,
);

psql(`update profiles set role='brand' where id='${second.uid}'`);
console.log(
  "PASS: D058 reports — anon/malformed/direct insert refused, ticket + 10/7-day deadlines, duplicate open, 5/day limit, requester-only visibility, interim hide, answer required, closed final, status log, deletion scrubs + suppresses (id/handle/url/republish blocked), appeal once by requester only and by a different admin, owner identity verified.",
);
