// D061 direct REST: checklist/review are brand-private; approval needs every current item; with a checklist,
// accepting an application without approval is refused by the DB on any path; nothing leaks to the profile.
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
  admin = await as(a.admin),
  anon = await as();
// A second brand, to prove brand-to-brand isolation.
const email2 = `review-brand-${Date.now()}@example.test`;
const { data: u2 } = await svc.auth.admin.createUser({
  email: email2,
  password: "Review-Brand-2026!",
  email_confirm: true,
  user_metadata: { ...qaSignupConsent, role: "brand", name: "검토 브랜드2" },
});
sql(`update profiles set role = 'brand' where id = '${u2.user.id}'`);
const brand2 = await as({ email: email2, password: "Review-Brand-2026!" });
const cid = sql(`select id from creators where owner_id = '${a.creator.id}'`);
const wasPublished = sql(`select published from creators where id = '${cid}'`);
sql(`update creators set published = true where id = '${cid}'`); // other tests may leave it unpublished
const MEMO = `비공개검토메모-${Date.now()}`;
const brief = sql(
  `select brief::text from campaigns where not is_demo limit 1`,
).replace(/'/g, "''");
const camp = sql(
  `insert into campaigns(owner_id, brief, status) values ('${a.brand.id}', '${brief}', 'published') returning id`,
).split("\n")[0];
const app = () =>
  sql(`insert into proposals(campaign_id, creator_id, brand_id, creator_user_id, kind, status, brief)
       values ('${camp}', '${cid}', '${a.brand.id}', '${a.creator.id}', 'application', 'pending', '선정 검토 게이트 확인용 지원서입니다.') returning id`).split(
    "\n",
  )[0];
try {
  // Checklist: brand only, own only, max 10.
  assert.ok(
    (
      await creator
        .from("review_checklist_items")
        .insert({ label: "크리에이터가 만든 항목" })
    ).error,
    "creator cannot create",
  );
  assert.ok(
    (await anon.from("review_checklist_items").insert({ label: "x" })).error,
  );
  const ins = await brand
    .from("review_checklist_items")
    .insert([{ label: "광고 표기 이력" }, { label: "브랜드 안전성" }])
    .select("id");
  assert.equal(ins.error, null);
  const items = ins.data.map((x) => x.id);
  assert.ok(
    (
      await brand
        .from("review_checklist_items")
        .insert({ label: "남의 것", brand_id: u2.user.id })
    ).error,
    "cannot write for another brand",
  );
  for (const db of [brand2, creator, admin, anon])
    assert.deepEqual(
      (await db.from("review_checklist_items").select("id").in("id", items))
        .data ?? [],
      [],
    );
  await brand2.from("review_checklist_items").delete().in("id", items);
  assert.equal(
    sql(
      `select count(*) from review_checklist_items where id in ('${items.join("','")}')`,
    ),
    "2",
    "other brand delete has no effect",
  );
  sql(
    `insert into review_checklist_items(brand_id, label) select '${u2.user.id}', 'i' || g from generate_series(1, 10) g`,
  );
  assert.ok(
    (await brand2.from("review_checklist_items").insert({ label: "11번째" }))
      .error,
    "cap 10",
  );

  // Gate: pending application cannot be accepted without approval.
  const p1 = app();
  const t1 = await brand.rpc("transition_proposal", {
    p_id: p1,
    p_action: "accepted",
  });
  assert.match(t1.error?.message ?? "", /review_required/);
  assert.throws(
    () => sql(`update proposals set status = 'accepted' where id = '${p1}'`),
    /review_required/,
    "gate holds outside the RPC too",
  );

  // Review writes: owner only, through the RPC; approval needs every item.
  assert.ok(
    (
      await brand.from("creator_reviews").insert({
        campaign_id: camp,
        creator_id: cid,
        brand_id: a.brand.id,
        approved: true,
      })
    ).error,
    "no direct write",
  );
  for (const db of [creator, brand2])
    assert.ok(
      (
        await db.rpc("set_creator_review", {
          p_campaign: camp,
          p_creator: cid,
          p_checked: items,
          p_memo: "x",
          p_approve: true,
        })
      ).error,
      "not the owner",
    );
  const partial = await brand.rpc("set_creator_review", {
    p_campaign: camp,
    p_creator: cid,
    p_checked: [items[0]],
    p_memo: MEMO,
    p_approve: true,
  });
  assert.match(partial.error?.message ?? "", /review_incomplete/);
  assert.equal(
    (
      await brand.rpc("set_creator_review", {
        p_campaign: camp,
        p_creator: cid,
        p_checked: [items[0], crypto.randomUUID()],
        p_memo: MEMO,
        p_approve: false,
      })
    ).data.checked,
    1,
    "foreign ids dropped",
  );
  const full = await brand.rpc("set_creator_review", {
    p_campaign: camp,
    p_creator: cid,
    p_checked: items,
    p_memo: MEMO,
    p_approve: true,
  });
  assert.equal(full.error, null);
  const row = (
    await brand.from("creator_reviews").select("*").eq("campaign_id", camp)
  ).data[0];
  assert.equal(row.reviewed_by, a.brand.id);
  assert.equal(row.memo, MEMO);

  // Adding an item re-opens the review.
  const extra = (
    await brand
      .from("review_checklist_items")
      .insert({ label: "계약 조건" })
      .select("id")
  ).data[0].id;
  assert.match(
    (await brand.rpc("transition_proposal", { p_id: p1, p_action: "accepted" }))
      .error?.message ?? "",
    /review_required/,
  );
  await brand.rpc("set_creator_review", {
    p_campaign: camp,
    p_creator: cid,
    p_checked: [...items, extra],
    p_memo: MEMO,
    p_approve: true,
  });
  assert.equal(
    (await brand.rpc("transition_proposal", { p_id: p1, p_action: "accepted" }))
      .error,
    null,
    "approved → selection allowed",
  );

  // Privacy: nobody else reads the review; memo is nowhere public.
  for (const db of [creator, brand2, admin, anon])
    assert.deepEqual(
      (await db.from("creator_reviews").select("memo").eq("campaign_id", camp))
        .data ?? [],
      [],
    );
  assert.equal(
    sql(`select count(*) from creators where profile::text like '%${MEMO}%'`),
    "0",
  );
} finally {
  sql(`delete from proposals where campaign_id = '${camp}'; delete from campaigns where id = '${camp}';
       delete from review_checklist_items where brand_id in ('${a.brand.id}', '${u2.user.id}')`);
  sql(
    `update creators set published = ${wasPublished === "t"} where id = '${cid}'`,
  );
  await svc.auth.admin.deleteUser(u2.user.id);
}
console.log(
  "PASS: D061 selection review — checklist brand-only/own-only/cap 10, gate refuses accept without approval (RPC and direct), approval needs every current item (new item re-opens), owner-only RPC writes, nobody else reads, memo not public",
);
