// D046 direct REST: feedback is written only by the server, readable only by its rater; the evaluation
// dataset is admin-only, has no rater id, and splits by campaign.
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
  admin = await as(a.admin),
  anon = await as();
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const brief = sql(
  `select brief::text from campaigns where not is_demo limit 1`,
);
const camps = [0, 1, 2].map(
  () =>
    sql(
      `insert into campaigns(owner_id, brief, status) values ('${a.brand.id}', '${brief.replace(/'/g, "''")}', 'draft') returning id`,
    ).split("\n")[0],
);
const row = (campaign_id, creator_id, o = {}) => ({
  campaign_id,
  creator_id,
  rater_id: a.brand.id,
  model_version: "adme-1.1",
  rank_position: 1,
  score: 80,
  verdict: "fit",
  reason: "vibe_match",
  ...o,
});

// Clients cannot write at all — not even the campaign owner (positions must come from the server).
assert.ok(
  (
    await brand
      .from("matching_feedback")
      .insert(row(camps[0], "creator-001", { rank_position: 1 }))
  ).error,
  "owner direct insert denied",
);
assert.ok(
  (
    await creator
      .from("matching_feedback")
      .insert(row(camps[0], "creator-001", { rater_id: a.creator.id }))
  ).error,
);
// Reason must fit the verdict (DB check).
assert.ok(
  (
    await svc
      .from("matching_feedback")
      .insert(
        row(camps[0], "creator-001", {
          verdict: "fit",
          reason: "brand_safety",
        }),
      )
  ).error,
);
for (const [i, c] of camps.entries())
  for (const id of ["creator-001", "creator-002"])
    assert.equal(
      (
        await svc
          .from("matching_feedback")
          .insert(row(c, id, { rank_position: i + 1 }))
      ).error,
      null,
    );
await brand
  .from("matching_feedback")
  .update({ verdict: "unfit" })
  .eq("campaign_id", camps[0]);
assert.equal(
  sql(
    `select string_agg(distinct verdict, ',') from matching_feedback where campaign_id = '${camps[0]}'`,
  ),
  "fit",
  "client update has no effect",
);

// Read: rater only.
assert.equal(
  (await brand.from("matching_feedback").select("id").in("campaign_id", camps))
    .data.length,
  6,
);
for (const db of [creator, admin, anon])
  assert.deepEqual(
    (await db.from("matching_feedback").select("id").in("campaign_id", camps))
      .data ?? [],
    [],
  );

// Dataset: admin/service only, no rater id or raw campaign id, campaign-grouped split, accept outcome as label.
for (const db of [anon, brand, creator])
  assert.ok(
    (await db.rpc("matching_feedback_dataset")).error,
    "dataset admin-only",
  );
sql(`insert into proposals(campaign_id, creator_id, brand_id, creator_user_id, kind, status, brief)
     select '${camps[1]}', 'creator-002', '${a.brand.id}', '${a.creator.id}', 'proposal', 'accepted', '수락 라벨 검증용 제안입니다.'
     on conflict do nothing`);
const { data, error } = await admin.rpc("matching_feedback_dataset");
assert.equal(error, null);
const text = JSON.stringify(data);
assert.ok(
  !text.includes(a.brand.id) && !camps.some((c) => text.includes(c)),
  "no rater id / raw campaign id",
);
const byCampaign = new Map();
for (const r of data)
  byCampaign.set(
    r.campaign_key,
    new Set([...(byCampaign.get(r.campaign_key) ?? []), r.split]),
  );
assert.ok(
  [...byCampaign.values()].every((s) => s.size === 1),
  "a campaign never spans train and test",
);
const key1 = sql(`select left(md5('${camps[1]}'), 12)`);
assert.equal(
  data.find((r) => r.campaign_key === key1 && r.creator_id === "creator-002")
    .accepted,
  true,
);
assert.equal(
  data.find((r) => r.campaign_key === key1 && r.creator_id === "creator-001")
    .accepted,
  false,
);
assert.ok(
  data.every((r) =>
    ["small", "mid", "large", "unknown"].includes(r.size_bucket),
  ),
);

sql(
  `delete from proposals where campaign_id in ('${camps.join("','")}'); delete from campaigns where id in ('${camps.join("','")}')`,
);
console.log(
  "PASS: D046 feedback — client writes denied (owner too), reason/verdict check, rater-only read, admin-only dataset without rater/campaign ids, campaign-grouped split, accept label",
);
