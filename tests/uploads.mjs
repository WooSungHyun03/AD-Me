// D027 direct storage/DB checks on the isolated local Supabase: browsers cannot write storage (either bucket),
// only the owner can sign a live file, signed URLs expire, references are server-written, sweep removes orphans.
import { qaSignupConsent } from "./support/consent-fixture.mjs";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { sweepUploads, BUCKET } from "../src/lib/uploads.ts";
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
const client = () =>
  createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    opts,
  );
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const fresh = async () => {
  const db = client();
  const r = await db.auth.signUp({
    email: `adme-qa-d027-${randomUUID().slice(0, 8)}@example.com`,
    password: randomUUID() + "Aa!",
    options: { data: { ...qaSignupConsent, role: "creator", name: "D027" } },
  });
  assert.equal(r.error, null);
  return { db, id: r.data.user.id };
};
const A = await fresh(),
  B = await fresh();
const png = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");

// 1. Direct browser writes are refused in the private bucket and in the old 'portfolios' bucket.
assert.ok(
  (
    await A.db.storage
      .from(BUCKET)
      .upload(`${A.id}/${randomUUID()}.png`, png, { contentType: "image/png" })
  ).error,
  "direct upload refused",
);
assert.ok(
  (
    await A.db.storage
      .from("portfolios")
      .upload(`${A.id}/x.png`, png, { contentType: "image/png" })
  ).error,
  "old bucket bypass closed",
);
// Even the server key cannot store HTML/SVG-typed objects: the bucket only accepts image/PDF types and 5MB.
assert.ok(
  (
    await admin.storage
      .from(BUCKET)
      .upload(`${A.id}/${randomUUID()}.png`, html, { contentType: "text/html" })
  ).error,
  "bucket refuses html type",
);
assert.ok(
  (
    await admin.storage
      .from(BUCKET)
      .upload(`${A.id}/${randomUUID()}.png`, png, {
        contentType: "image/svg+xml",
      })
  ).error,
  "bucket refuses svg type",
);
assert.equal(
  (await admin.storage.getBucket(BUCKET)).data.public,
  false,
  "bucket is private",
);

// 2. Server-written file (what /api/uploads does after inspection).
const id = randomUUID(),
  path = `${A.id}/${id}.png`;
assert.equal(
  (
    await admin.storage
      .from(BUCKET)
      .upload(path, png, { contentType: "image/png" })
  ).error,
  null,
);
assert.ok(
  (
    await admin
      .from("uploads")
      .insert({
        id,
        owner_id: A.id,
        path: `${B.id}/${id}.png`,
        mime: "image/png",
        size_bytes: 11,
        original_name: "a.png",
        rights_confirmed: true,
      })
  ).error,
  "path must be the owner's namespace",
);
assert.ok(
  (
    await admin
      .from("uploads")
      .insert({
        id,
        owner_id: A.id,
        path,
        mime: "image/png",
        size_bytes: 11,
        original_name: "a.png",
        rights_confirmed: false,
      })
  ).error,
  "rights attestation required",
);
assert.equal(
  (
    await admin
      .from("uploads")
      .insert({
        id,
        owner_id: A.id,
        path,
        mime: "image/png",
        size_bytes: 11,
        original_name: "a.png",
        rights_confirmed: true,
      })
  ).error,
  null,
);
// Public URL does not work on a private bucket.
assert.notEqual(
  (await fetch(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl))
    .status,
  200,
  "no public access",
);

// 3. Owner signs and downloads; other owner and anon cannot sign or read.
const signed = await A.db.storage.from(BUCKET).createSignedUrl(path, 60);
assert.equal(signed.error, null);
assert.deepEqual(
  new Uint8Array(await (await fetch(signed.data.signedUrl)).arrayBuffer()),
  png,
);
assert.ok(
  (await B.db.storage.from(BUCKET).createSignedUrl(path, 60)).error,
  "other owner cannot sign",
);
assert.ok(
  (await client().storage.from(BUCKET).createSignedUrl(path, 60)).error,
  "anon cannot sign",
);
assert.ok(
  (await B.db.storage.from(BUCKET).download(path)).error,
  "other owner cannot download",
);
assert.equal(
  (await B.db.from("uploads").select("id").eq("id", id)).data.length,
  0,
  "other owner cannot see reference",
);
assert.equal(
  (await B.db.storage.from(BUCKET).list(A.id)).data?.length ?? 0,
  0,
  "other owner cannot list",
);
// 4. Short expiry.
const short = await A.db.storage.from(BUCKET).createSignedUrl(path, 1);
await new Promise((r) => setTimeout(r, 2500));
assert.notEqual(
  (await fetch(short.data.signedUrl)).status,
  200,
  "signed URL expires",
);
// 5. No direct reference writes, overwrite or delete.
assert.ok(
  (
    await A.db
      .from("uploads")
      .insert({
        id: randomUUID(),
        owner_id: A.id,
        path: `${A.id}/${randomUUID()}.png`,
        mime: "image/png",
        size_bytes: 1,
        original_name: "x.png",
        rights_confirmed: true,
      })
  ).error,
);
assert.ok(
  (await A.db.from("uploads").update({ mime: "application/pdf" }).eq("id", id))
    .error,
);
assert.ok(
  (
    await A.db.storage
      .from(BUCKET)
      .upload(path, html, { contentType: "image/png", upsert: true })
  ).error,
  "no overwrite",
);
await A.db.storage.from(BUCKET).remove([path]);
assert.equal(
  (await admin.storage.from(BUCKET).list(A.id)).data.length,
  1,
  "direct remove has no effect",
);
// 6. Delete: other owner cannot, owner can; afterwards signing is refused.
assert.match(
  (await B.db.rpc("delete_upload", { p_id: id })).error.message,
  /not_found/,
);
assert.equal((await A.db.rpc("delete_upload", { p_id: id })).data, "deleted");
assert.ok(
  (await A.db.storage.from(BUCKET).createSignedUrl(path, 60)).error,
  "deleted file cannot be signed",
);
assert.equal((await A.db.from("uploads").select("id")).data.length, 0);

// 7. Sweep: deleted reference's object and unreferenced (orphan) objects are removed; live files stay.
const liveId = randomUUID(),
  livePath = `${B.id}/${liveId}.png`,
  orphan = `${B.id}/${randomUUID()}.png`;
await admin.storage
  .from(BUCKET)
  .upload(livePath, png, { contentType: "image/png" });
await admin
  .from("uploads")
  .insert({
    id: liveId,
    owner_id: B.id,
    path: livePath,
    mime: "image/png",
    size_bytes: 11,
    original_name: "live.png",
    rights_confirmed: true,
  });
await admin.storage
  .from(BUCKET)
  .upload(orphan, png, { contentType: "image/png" });
const kept = await sweepUploads(admin); // default grace: fresh orphan survives (in-flight upload)
assert.equal(kept.orphans, 0);
const r = await sweepUploads(admin, 0);
assert.ok(r.orphans >= 1 && r.purgedRows >= 0);
const names = async (o) =>
  (await admin.storage.from(BUCKET).list(o)).data.map((f) => f.name);
assert.deepEqual(await names(A.id), [], "deleted file removed");
assert.deepEqual(
  await names(B.id),
  [`${liveId}.png`],
  "orphan removed, live kept",
);
assert.equal(
  (await admin.from("uploads").select("id").eq("id", id)).data.length,
  0,
  "deleted row purged",
);
assert.ok(
  (await B.db.storage.from(BUCKET).createSignedUrl(livePath, 60)).data
    ?.signedUrl,
  "live file still works",
);
console.log(
  "PASS: D027 uploads — direct writes refused (both buckets), type/size enforced, owner-only sign, expiry, no overwrite, delete, sweep",
);
