// D040 direct REST: private notes are owner-only; comparison share tokens are server-minted, revocable,
// and the shared view exposes only title + creator ids.
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
const a = JSON.parse(readFileSync(".accounts.local.json", "utf8"));
const opts = { auth: { persistSession: false } };
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
  other = await as(a.creator),
  admin = await as(a.admin),
  anon = await as();

// Notes: owner only — even admin sees none; nobody writes a note as someone else.
const secret = `비공개 메모 ${Date.now()} 예산 300만원`;
assert.equal(
  (
    await brand
      .from("creator_notes")
      .upsert({ owner_id: a.brand.id, creator_id: "creator-001", body: secret })
  ).error,
  null,
);
for (const db of [other, admin, anon]) {
  const { data } = await db.from("creator_notes").select("body");
  assert.ok(
    !(data ?? []).some((n) => n.body === secret),
    "note invisible to others",
  );
  await db
    .from("creator_notes")
    .update({ body: "tampered" })
    .eq("owner_id", a.brand.id);
  await db.from("creator_notes").delete().eq("owner_id", a.brand.id);
}
assert.ok(
  (
    await other
      .from("creator_notes")
      .insert({
        owner_id: a.brand.id,
        creator_id: "creator-002",
        body: "forged",
      })
  ).error,
);
assert.equal(
  (
    await brand
      .from("creator_notes")
      .select("body")
      .eq("creator_id", "creator-001")
      .single()
  ).data.body,
  secret,
);
assert.ok(
  (
    await brand
      .from("creator_notes")
      .upsert({ owner_id: a.brand.id, creator_id: "creator-001", body: "" })
  ).error,
  "empty body rejected",
);
// Separate from proposal messages: no message carries the note text.
assert.deepEqual(
  (await admin.from("messages").select("id").eq("body", secret)).data,
  [],
);

// Comparisons: private by default, size 2–3, owner-only rows.
assert.ok(
  (
    await brand
      .from("compare_reports")
      .insert({
        owner_id: a.brand.id,
        title: "x",
        creator_ids: ["creator-001"],
      })
  ).error,
  "needs 2–3",
);
const { data: r, error } = await brand
  .from("compare_reports")
  .insert({
    owner_id: a.brand.id,
    title: "공유 테스트",
    creator_ids: ["creator-001", "creator-002"],
    share: "link",
    share_token: "chosen-by-client",
  })
  .select("id,share_token")
  .single();
assert.equal(error, null);
assert.match(
  r.share_token,
  /^[0-9a-f]{36}$/,
  "token minted by the server, not the client",
);
for (const db of [other, admin, anon])
  assert.deepEqual(
    (await db.from("compare_reports").select("id").eq("id", r.id)).data ?? [],
    [],
  );
assert.ok(
  (
    await other
      .from("compare_reports")
      .insert({
        owner_id: a.brand.id,
        title: "f",
        creator_ids: ["creator-001", "creator-002"],
      })
  ).error,
);
await brand
  .from("compare_reports")
  .update({ share_token: "f".repeat(36) })
  .eq("id", r.id);
assert.equal(
  (
    await brand
      .from("compare_reports")
      .select("share_token")
      .eq("id", r.id)
      .single()
  ).data.share_token,
  r.share_token,
  "token not client-settable",
);

// Shared view: anon reads title + ids only; nothing else exists in the result.
const shared = await anon.rpc("shared_compare", { p_token: r.share_token });
assert.equal(shared.error, null);
assert.deepEqual(shared.data, [
  { title: "공유 테스트", creator_ids: ["creator-001", "creator-002"] },
]);
assert.ok(
  !JSON.stringify(shared.data).includes(a.brand.id) &&
    !JSON.stringify(shared.data).includes(secret),
);
assert.deepEqual((await anon.rpc("shared_compare", { p_token: "" })).data, []);
// Revoke: link off → token gone, old link resolves to nothing; re-enabling mints a new token.
await brand.from("compare_reports").update({ share: "private" }).eq("id", r.id);
assert.deepEqual(
  (await anon.rpc("shared_compare", { p_token: r.share_token })).data,
  [],
  "revoked link dead",
);
const re = (
  await brand
    .from("compare_reports")
    .update({ share: "link" })
    .eq("id", r.id)
    .select("share_token")
    .single()
).data;
assert.notEqual(re.share_token, r.share_token, "re-share gets a new token");
await brand.from("compare_reports").delete().eq("id", r.id);
await brand.from("creator_notes").delete().eq("creator_id", "creator-001");
console.log(
  "PASS: D040 notes/compare — notes owner-only (admin too), separate from messages, 2–3 size, server-minted revocable token, shared view = title+ids",
);
