// D033 direct REST checks against the isolated local Supabase.
import { createClient } from "@supabase/supabase-js";
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
const anon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const owner = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
assert.equal((await owner.auth.signInWithPassword(a.creator)).error, null);

async function walk(db, sort, extra = {}) {
  const ids = [];
  let after = null;
  for (let i = 0; i < 100; i++) {
    const { data, error } = await db.rpc("search_creators", {
      p_include_demo: true,
      p_sort: sort,
      p_limit: 7,
      p_after_key: after?.sort_key ?? null,
      p_after_id: after?.id ?? null,
      ...extra,
    });
    assert.equal(error, null);
    for (const r of data) {
      assert.ok(
        !("owner_id" in r.profile) &&
          !("owner_consent" in r.profile) &&
          !("owner_id" in r),
        "no owner fields",
      );
      ids.push(r.id);
    }
    if (data.length < 7) return ids;
    after = data.at(-1);
  }
  throw new Error("pagination did not terminate");
}
const total = (await anon.rpc("count_creators", { p_include_demo: true })).data;
for (const sort of ["name", "followers", "price"]) {
  const ids = await walk(anon, sort);
  assert.equal(new Set(ids).size, ids.length, `no duplicates (${sort})`);
  assert.equal(ids.length, total, `no gaps (${sort})`);
}
// Owner's unpublished draft never appears in public search, even for the owner.
const draftId = `user-${a.creator.id}`;
const { data: own } = await owner
  .from("creators")
  .select("published")
  .eq("id", draftId)
  .maybeSingle();
assert.ok(own, "creator fixture row must exist for this check");
await owner.from("creators").update({ published: false }).eq("id", draftId);
assert.ok(
  !(await walk(owner, "name")).includes(draftId),
  "draft hidden from owner search",
);
if (own?.published)
  await owner.from("creators").update({ published: true }).eq("id", draftId);
// free_beta: demo rows excluded.
const real = (
  await anon.rpc("search_creators", { p_include_demo: false, p_limit: 49 })
).data;
assert.ok(real.every((r) => r.profile.is_demo === false));
// Page size is clamped server-side, sort is allowlisted, LIKE wildcards are literal.
assert.equal(
  (await anon.rpc("search_creators", { p_include_demo: true, p_limit: 100000 }))
    .data.length,
  49,
);
assert.ok((await anon.rpc("search_creators", { p_sort: "owner_id" })).error);
assert.equal(
  (await anon.rpc("search_creators", { p_include_demo: true, p_q: "%" })).data
    .length,
  0,
);
assert.equal(
  (
    await anon.rpc("count_creators", {
      p_include_demo: true,
      p_platform: "youtube",
    })
  ).data,
  (await walk(anon, "price", { p_platform: "youtube" })).length,
);
console.log(
  `PASS: D033 search — ${total} rows paged by name/followers/price without dupes or gaps, no owner fields, owner draft hidden, demo excluded in free_beta, limit clamp 49, sort allowlist, literal LIKE, count matches.`,
);
