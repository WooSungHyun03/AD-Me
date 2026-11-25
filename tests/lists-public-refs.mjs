// D036 direct REST contract on the isolated local Supabase: named groups and campaign shortlists
// accept public creator references, stay owner-only, are retry-safe and never expose internal IDs.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  );
const opts = { auth: { persistSession: false } };
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
const service = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const login = async (acc) => {
  const db = client();
  assert.equal((await db.auth.signInWithPassword(acc)).error, null);
  return db;
};
const brand = await login(a.brand),
  other = await login(a.other),
  anon = client();
const tag = randomUUID().slice(0, 6);
const results = [];
const check = (name, fn) => {
  fn();
  results.push(name);
};

// A real (non-demo) registered creator: the catalog exposes an opaque public reference, not user-<uuid>.
const cdb = client();
const signup = await cdb.auth.signUp({
  email: `adme-qa-d036-${tag}-${randomUUID().slice(0, 8)}@example.com`,
  password: randomUUID() + "Aa!",
  options: { data: { ...qaSignupConsent, role: "creator", name: "D036" } },
});
assert.equal(signup.error, null);
const uid = signup.data.user.id,
  internal = `user-${uid}`;
// Local owner fixture only (session_user postgres): the consent publication flow is covered elsewhere.
sql(
  `insert into public.creators(id,owner_id,published,profile) values('${internal}','${uid}',true,'{"name":"D036 후보 ${tag}","bio":"","handle":"self_reported","categories":["뷰티"],"vibes":["자연스러움"],"formats":["숏폼"],"platforms":["youtube"],"price_min_krw":null,"price_max_krw":null,"followers":0,"is_available":true,"is_demo":false}')`,
);
const pub = (await brand.rpc("creator_public_one", { p_ref: internal })).data;
assert.ok(pub?.seed_id, "registered creator is catalog-visible");
const ref = pub.seed_id;
check("public reference is opaque", () => assert.notEqual(ref, internal));

const group = (
  await brand
    .from("saved_lists")
    .insert({ owner_id: a.brand.id, name: `D036 공개참조 ${tag}` })
    .select("id")
    .single()
).data.id;

// Reproduction of the pre-fix route: inserting the browser's reference as a row ID fails (FK).
const legacy = await brand
  .from("saved_list_items")
  .insert({ list_id: group, creator_id: ref, owner_id: a.brand.id });
check("legacy direct insert with public ref fails", () =>
  assert.equal(legacy.error?.code, "23503"),
);

const add = (db, list, r) =>
  db.rpc("add_saved_list_item", { p_list: list, p_ref: r });
const remove = (db, list, r) =>
  db.rpc("remove_saved_list_item", { p_list: list, p_ref: r });

// Success + retry: the second identical add is acknowledged without a duplicate row.
let r = await add(brand, group, ref);
check("owner adds by public ref", () => {
  assert.equal(r.error, null);
  assert.equal(r.data, "added");
});
r = await add(brand, group, ref);
check("retry is idempotent", () => assert.equal(r.data, "exists"));
const rows = await service
  .from("saved_list_items")
  .select("creator_id")
  .eq("list_id", group);
check("exactly one stored row with the internal ID", () =>
  assert.deepEqual(rows.data, [{ creator_id: internal }]),
);
const parallel = await Promise.all([1, 2, 3].map(() => add(brand, group, ref)));
check("concurrent retries never error", () =>
  parallel.forEach((x) => assert.equal(x.error, null)),
);

// Owner read DTO: public ref + name, no internal ID or owner columns.
const mine = (await brand.rpc("my_saved_lists")).data;
const dto = mine.find((l) => l.id === group);
check("owner DTO exposes public reference only", () => {
  assert.deepEqual(dto.items, [
    { ref, name: `D036 후보 ${tag}`, visible: true },
  ]);
  assert.ok(!JSON.stringify(mine).includes(uid), "no owner/internal UUID");
  assert.ok(!("owner_id" in dto));
});

// Denials: other account, anonymous, unknown reference — all without revealing which part failed.
const otherLists = (await other.rpc("my_saved_lists")).data;
check("other DTO excludes my lists", () =>
  assert.ok(!otherLists.some((l) => l.id === group)),
);
r = await add(other, group, ref);
check("other account cannot add to my list", () =>
  assert.equal(r.error?.code, "42501"),
);
r = await remove(other, group, ref);
check("other account cannot remove from my list", () =>
  assert.equal(r.data, false),
);
r = await add(brand, group, `missing-${tag}`);
check("unknown reference denied", () => assert.equal(r.error?.code, "42501"));
for (const fn of ["add_saved_list_item", "remove_saved_list_item"]) {
  r = await anon.rpc(fn, { p_list: group, p_ref: ref });
  check(`anon cannot execute ${fn}`, () => assert.ok(r.error));
}
r = await anon.rpc("my_saved_lists");
check("anon cannot execute my_saved_lists", () => assert.ok(r.error));

// Campaign shortlist: add through the same gateway; another brand cannot write into it.
const camp = (
  await brand
    .from("campaigns")
    .insert({
      owner_id: a.brand.id,
      status: "draft",
      brief: {
        title: `D036 후보 캠페인 ${tag}`,
        product: "QA",
        category: "뷰티",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["youtube"],
        budget_krw: 100000,
        target_audience: "QA 고객",
        goal: "후보 검증",
        status: "draft",
      },
    })
    .select("id")
    .single()
).data.id;
const short = (
  await brand
    .from("saved_lists")
    .insert({
      owner_id: a.brand.id,
      name: `D036 캠페인 후보 ${tag}`,
      campaign_id: camp,
    })
    .select("id")
    .single()
).data.id;
r = await add(brand, short, ref);
check("campaign shortlist add", () => assert.equal(r.data, "added"));
r = await add(other, short, ref);
check("other brand cannot add to my campaign shortlist", () =>
  assert.equal(r.error?.code, "42501"),
);

// Hidden after save: the row stays removable, its name is withheld, and it cannot be re-added.
sql(`update public.creators set published=false where id='${internal}'`);
const hidden = (await brand.rpc("my_saved_lists")).data.find(
  (l) => l.id === group,
);
check("hidden creator keeps row without name", () =>
  assert.deepEqual(hidden.items, [{ ref, name: null, visible: false }]),
);
r = await add(brand, short, ref);
check("hidden creator cannot be added", () => {
  // Already present in the shortlist → idempotent; a fresh list must still be denied.
  assert.ok(r.data === "exists" || r.error?.code === "42501");
});
const fresh = (
  await brand
    .from("saved_lists")
    .insert({ owner_id: a.brand.id, name: `D036 새 그룹 ${tag}` })
    .select("id")
    .single()
).data.id;
r = await add(brand, fresh, ref);
check("hidden creator denied for a new list", () =>
  assert.equal(r.error?.code, "42501"),
);
r = await remove(brand, group, ref);
check("owner removes hidden item by ref", () => assert.equal(r.data, true));
r = await remove(brand, group, ref);
check("repeat remove reports nothing removed", () =>
  assert.equal(r.data, false),
);

await brand.from("campaigns").delete().eq("id", camp);
await brand.from("saved_lists").delete().in("id", [group, fresh]);
sql(`delete from public.creators where id='${internal}'`);
await service.auth.admin.deleteUser(uid);
console.log(`PASS: D036 public-ref lists — ${results.length} checks`);
for (const n of results) console.log(" -", n);
