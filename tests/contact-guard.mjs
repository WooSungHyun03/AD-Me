// D062 direct REST checks on the isolated local Supabase: a user-level block (user_blocks) or an
// admin contact restriction must stop messages and new proposals on every write path, including
// the SECURITY DEFINER conversation_send RPC used by the current chat UI.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { qaSignupConsent } from "./support/consent-fixture.mjs";
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
      "-Atq",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: { persistSession: false },
    },
  );
const tag = randomUUID().slice(0, 8);
async function account(role) {
  const db = client();
  const { data, error } = await db.auth.signUp({
    email: `adme-qa-d062g-${role}-${tag}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role, name: `D062 ${role}` } },
  });
  assert.equal(error, null);
  return { db, id: data.user.id };
}
const qa = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const brandDb = client();
assert.equal((await brandDb.auth.signInWithPassword(qa.brand)).error, null);
const brand = { db: brandDb, id: qa.brand.id },
  creator = await account("creator");
const cid = `user-${creator.id}`;
sql(
  `insert into public.creators(id,owner_id,published,profile) values('${cid}','${creator.id}',true,'{"name":"D062 가드","bio":"","handle":"qa","categories":["뷰티"],"vibes":[],"formats":["숏폼"],"platforms":["youtube"],"price_min_krw":100000,"price_max_krw":300000,"followers":0,"is_available":true,"is_demo":false}')`,
);
const campRes = await brand.db
  .from("campaigns")
  .insert({
    owner_id: brand.id,
    status: "published",
    brief: {
      title: `D062 가드 ${tag}`,
      product: "QA",
      category: "뷰티",
      vibes: ["자연스러움"],
      format: "숏폼",
      platforms: ["youtube"],
      budget_krw: 100000,
      target_audience: "QA",
      goal: "연락 가드",
      status: "published",
    },
  })
  .select("id,brief")
  .single();
assert.equal(campRes.error, null, JSON.stringify(campRes.error));
const camp = campRes.data.id;
const made = await brand.db.rpc("create_creator_proposal", {
  p_campaign: camp,
  p_creator: cid,
  p_kind: "proposal",
  p_brief: "D062 연락 가드 검증용 제안입니다.",
});
assert.equal(made.error, null);
const pid = made.data;
const send = (who, body) =>
  who.db.rpc("conversation_send", {
    p_proposal: pid,
    p_key: randomUUID(),
    p_body: body,
    p_kind: "message",
    p_url: null,
  });
const results = [];
const check = (name, ok) => {
  assert.ok(ok, name);
  results.push(name);
};

let r = await send(creator, "제한 전 메시지");
check("baseline message allowed", r.error === null);

// Admin contact restriction on the creator.
sql(
  `insert into public.contact_restrictions(user_id,reason,starts_at,ends_at,created_by) values('${creator.id}','D062 가드 검증',now(),now()+interval '1 day',(select id from public.profiles where role='admin' limit 1))`,
);
r = await send(creator, "제한 중 메시지");
check(
  "restricted user cannot message through conversation_send",
  r.error !== null,
);
sql(
  `update public.contact_restrictions set lifted_at=now() where user_id='${creator.id}'`,
);
r = await send(creator, "해제 후 메시지");
check("lifted restriction allows messages again", r.error === null);

// User-level block by the creator.
sql(
  `insert into public.user_blocks(blocker_id,blocked_id) values('${creator.id}','${brand.id}')`,
);
r = await send(brand, "차단 후 메시지");
check("blocked counterpart cannot message", r.error !== null);
r = await send(creator, "차단한 쪽 메시지");
check("blocker cannot message the blocked user either", r.error !== null);

const camp2 = (
  await brand.db
    .from("campaigns")
    .insert({
      owner_id: brand.id,
      status: "published",
      brief: { ...campRes.data.brief, title: `D062 가드2 ${tag}` },
    })
    .select("id,brief")
    .single()
).data;
r = await brand.db.rpc("create_creator_proposal", {
  p_campaign: camp2?.id,
  p_creator: cid,
  p_kind: "proposal",
  p_brief: "차단 상태에서 보내는 새 제안입니다.",
});
check(
  "blocked counterpart cannot open a new proposal through the RPC",
  r.error !== null && /blocked/.test(r.error.message),
);
sql(`delete from public.user_blocks where blocker_id='${creator.id}'`);
sql(
  `update public.campaigns set status='closed' where id in ('${camp}','${camp2?.id ?? camp}')`,
);
console.log(`PASS: D062 contact guard — ${results.length} checks`);
for (const n of results) console.log(" -", n);
