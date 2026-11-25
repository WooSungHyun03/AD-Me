// D070 direct REST: the HOT slot is service-only with a minimal DTO, counts impressions, respects expiry/revoke,
// and never changes organic search order. Clients cannot read the old full-profile RPC or write impressions.
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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
const cid = sql(`select id from creators where owner_id = '${a.creator.id}'`);
const was = sql(
  `select published::text || '|' || claim_status from creators where id = '${cid}'`,
);
const search = async (sort) => {
  const r = await anon.rpc("search_creators", {
    p_q: null,
    p_category: null,
    p_platform: null,
    p_tag: null,
    p_budget: null,
    p_available: null,
    p_min_followers: null,
    p_max_followers: null,
    p_include_demo: true,
    p_sort: sort,
    p_after_key: null,
    p_after_id: null,
    p_limit: 100,
  });
  assert.equal(r.error, null);
  return r.data.map((x) => x.id ?? x.creator_id);
};
const slots = async (record) =>
  (await svc.rpc("serve_promotion_slots", { p_record: record })).data;
const imp = (e) =>
  Number(
    sql(
      `select coalesce(sum(n), 0) from promotion_impressions where entitlement_id = '${e}'`,
    ),
  );
// Slots carry the opaque public reference, never the internal user-<uuid> ID.
const ref = sql(`select adme_creator.public_reference('${cid}')`);
// D070 slots require an owner-verified creator with a consented, reviewed and fresh YouTube channel
// claim. Local-only fixture, removed in finally.
const channel = `UC${randomUUID().replaceAll("-", "").slice(0, 22)}`;
let ent;
try {
  sql(`update creators set published = true, claim_status = 'verified' where id = '${cid}';
       insert into adme_ops.channels(channel_id,title,review,source_policy,fetched_at,expires_at)
         values('${channel}','D070 QA 채널','accepted','ci-source-fixture',now(),now()+interval '1 day');
       insert into adme_ops.channel_claims(channel_id,owner_id,verified_at,consent_at)
         values('${channel}','${a.creator.id}',now(),now());`);
  for (const db of [brand, creator, anon]) {
    assert.ok(
      (await db.rpc("serve_promotion_slots", { p_record: true })).error,
      "slot source is service only",
    );
    assert.ok(
      (await db.rpc("active_hot_creators")).error,
      "old full-profile RPC no longer callable",
    );
  }
  const before = {
    rel: await search("name"),
    fol: await search("followers"),
    price: await search("price"),
  };
  assert.ok(!(await slots(false)).some((s) => s.creator_id === ref));

  ent = (
    await admin.rpc("admin_grant_entitlement", {
      p_owner: a.creator.id,
      p_sku: "creator_hot",
      p_days: 7,
      p_credits: 0,
      p_note: "D070 슬롯 검증",
    })
  ).data;
  assert.ok(ent);
  const s = (await slots(false)).find((x) => x.creator_id === ref);
  assert.ok(s, "active HOT appears in the slot");
  assert.deepEqual(
    Object.keys(s).sort(),
    ["category", "creator_id", "expires_at", "name", "slot", "starts_at"],
    "minimal DTO",
  );
  assert.ok((await slots(false)).length <= 3);

  // Organic order is identical with and without HOT.
  assert.deepEqual(await search("name"), before.rel);
  assert.deepEqual(await search("followers"), before.fol);
  assert.deepEqual(await search("price"), before.price);

  // Impressions: only when recorded; owner/admin read, others nothing; no client writes.
  assert.equal(imp(ent), 0);
  await slots(true);
  await slots(true);
  assert.equal(imp(ent), 2);
  assert.equal(
    (
      await creator
        .from("promotion_impressions")
        .select("n")
        .eq("entitlement_id", ent)
    ).data[0].n,
    2,
  );
  assert.equal(
    (
      await admin
        .from("promotion_impressions")
        .select("n")
        .eq("entitlement_id", ent)
    ).data.length,
    1,
  );
  for (const db of [brand, anon])
    assert.deepEqual(
      (
        await db
          .from("promotion_impressions")
          .select("n")
          .eq("entitlement_id", ent)
      ).data ?? [],
      [],
    );
  assert.ok(
    (
      await creator
        .from("promotion_impressions")
        .insert({ entitlement_id: ent, n: 999 })
    ).error,
  );
  await creator
    .from("promotion_impressions")
    .update({ n: 999 })
    .eq("entitlement_id", ent);
  assert.equal(imp(ent), 2, "owner cannot inflate impressions");

  // Unpublished creator → not slotted.
  sql(`update creators set published = false where id = '${cid}'`);
  assert.ok(!(await slots(false)).some((x) => x.creator_id === ref));
  sql(`update creators set published = true where id = '${cid}'`);

  // Expiry by the DB clock → gone, and no further impressions.
  sql(
    `update entitlements set expires_at = now() + interval '1 second' where id = '${ent}'`,
  );
  await new Promise((r) => setTimeout(r, 1500));
  assert.ok(
    !(await slots(true)).some((x) => x.creator_id === ref),
    "expired HOT not served",
  );
  assert.equal(imp(ent), 2);

  // Revoked → gone.
  const ent2 = (
    await admin.rpc("admin_grant_entitlement", {
      p_owner: a.creator.id,
      p_sku: "creator_hot",
      p_days: 7,
      p_credits: 0,
      p_note: "D070 회수 검증",
    })
  ).data;
  assert.ok((await slots(false)).some((x) => x.creator_id === ref));
  await admin.rpc("revoke_entitlement", {
    p_id: ent2,
    p_reason: "D070 회수 검증",
  });
  assert.ok(
    !(await slots(false)).some((x) => x.creator_id === ref),
    "revoked HOT not served",
  );
} finally {
  const [pub, claim] = was.split("|");
  sql(`update creators set published = ${pub === "true"}, claim_status = '${claim}' where id = '${cid}';
       delete from entitlements where owner_id = '${a.creator.id}' and sku = 'creator_hot' and grant_note like 'D070%';
       delete from adme_ops.channel_claims where channel_id = '${channel}'; delete from adme_ops.channels where channel_id = '${channel}';`);
}
console.log(
  "PASS: D070 promotion slots — service-only minimal DTO (≤3), old RPC closed, organic order unchanged, impressions counted only on serve and owner/admin-readable, unpublished/expired/revoked not served",
);
