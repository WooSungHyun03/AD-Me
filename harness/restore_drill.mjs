// D087: backup → disaster → restore drill on the LOCAL isolated Supabase only. Measures RPO/RTO and verifies
// row counts, a pre-backup marker present, a post-backup marker lost (= RPO), Auth sign-in, Storage file bytes,
// and tombstone re-application. The backup format is the one a Free-plan user can make themselves:
// a data-only pg_dump (public + auth.users/identities + storage metadata) plus a separate Storage file export.
//   node harness/restore_drill.mjs [backupDir]
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
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
  "local isolated Supabase only — never a hosted project",
);
const dir = process.argv[2] ?? "backups/drill";
const opts = { auth: { persistSession: false } };
const svc = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  opts,
);
const sql = (q, user = "postgres") =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_AD-Me",
      "psql",
      "-U",
      user,
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-qtA",
    ],
    {
      input: q,
      encoding: "utf8",
      maxBuffer: 1 << 28,
    },
  ).trim();
const tables = () =>
  sql(
    `select tablename from pg_tables where schemaname = 'public' order by 1`,
  ).split("\n");
const counts = () =>
  Object.fromEntries(
    tables().map((t) => [t, Number(sql(`select count(*) from public."${t}"`))]),
  );
const t = () => performance.now();
const secs = (a, b) => Math.round(b - a) / 1000;

// 0. Markers around the backup point.
const tag = `drill-${Date.now()}`;
sql(
  `insert into audit_log(entity_id, action) values ('${tag}', 'before-backup')`,
);
// A private portfolio file owned by the QA creator (exercises Storage export/import and owner access).
const creator = JSON.parse(
  readFileSync(".accounts.local.json", "utf8"),
).creator;
const upId = crypto.randomUUID(),
  upPath = `${creator.id}/${upId}.png`;
const png = Buffer.from("89504e470d0a1a0a" + "00".repeat(24), "hex");
assert.equal(
  (
    await svc.storage
      .from("private-uploads")
      .upload(upPath, png, { contentType: "image/png" })
  ).error,
  null,
);
assert.equal(
  (
    await svc
      .from("uploads")
      .insert({
        id: upId,
        owner_id: creator.id,
        path: upPath,
        mime: "image/png",
        size_bytes: png.length,
        original_name: "drill.png",
        rights_confirmed: true,
      })
  ).error,
  null,
);

// 1. Backup.
rmSync(dir, { recursive: true, force: true });
mkdirSync(join(dir, "files"), { recursive: true });
const b0 = t();
const dump = execFileSync(
  "docker",
  [
    "exec",
    "supabase_db_AD-Me",
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--data-only",
    "-t",
    "public.*", // not -n: with any -t, pg_dump ignores -n (would silently drop public data)

    "-t",
    "auth.users",
    "-t",
    "auth.identities",
    "-t",
    "storage.buckets",
    "-t",
    "storage.objects",
  ],
  { maxBuffer: 1 << 28 },
);
writeFileSync(join(dir, "db.sql"), dump);
const dumped = new Set(
  [...dump.toString().matchAll(/^COPY public\.(\S+) /gm)].map((m) =>
    m[1].replaceAll('"', ""),
  ),
);
assert.deepEqual(
  tables().filter((x) => !dumped.has(x)),
  [],
  "every public table is in the dump",
);
const objects = sql(
  `select bucket_id || '|' || name || '|' || coalesce(metadata->>'mimetype', 'application/octet-stream') from storage.objects order by 1`,
)
  .split("\n")
  .filter(Boolean);
for (const o of objects) {
  const [bucket, name] = o.split("|");
  const { data, error } = await svc.storage.from(bucket).download(name);
  assert.equal(error, null, `download ${bucket}/${name}`);
  const p = join(dir, "files", bucket, name);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, Buffer.from(await data.arrayBuffer()));
}
const before = counts();
writeFileSync(
  join(dir, "manifest.json"),
  JSON.stringify(
    { at: new Date().toISOString(), counts: before, objects },
    null,
    2,
  ),
);
const backupSecs = secs(b0, t());
const backupAt = Date.now();

// 2. Writes after the backup (lost by design → RPO), then the disaster: files deleted and database wiped.
sql(
  `insert into audit_log(entity_id, action) values ('${tag}', 'after-backup')`,
);
for (const o of objects) {
  const [bucket, name] = o.split("|");
  await svc.storage.from(bucket).remove([name]);
}
const disasterAt = Date.now();
const z0 = t();
execFileSync("npx", ["supabase@2", "db", "reset"], { stdio: "ignore" }); // schema + migrations, no data
// The reset restarts the API services; wait until Storage answers before restoring files.
for (
  let i = 0;
  i < 60 && (await svc.storage.listBuckets().catch(() => ({ error: 1 }))).error;
  i++
)
  await new Promise((r) => setTimeout(r, 1000));

const schemaSecs = secs(z0, t());
// 3. Restore (RTO clock).
const r0 = t();
sql(
  `set session_replication_role = replica;
   truncate ${tables()
     .map((x) => `public."${x}"`)
     .join(
       ", ",
     )}, auth.identities, auth.users, storage.objects, storage.buckets cascade;
   ${readFileSync(join(dir, "db.sql"), "utf8")}`,
  "supabase_admin",
);
const r1 = t();
for (const o of objects) {
  const [bucket, name, contentType] = o.split("|");
  const body = readFileSync(join(dir, "files", bucket, name));
  const { error } = await svc.storage
    .from(bucket)
    .upload(name, body, { upsert: true, contentType });
  assert.equal(error, null, `re-upload ${bucket}/${name}`);
}
const r2 = t();
const ledger = JSON.parse(
  readFileSync(
    join(dir, "files", "privacy-ledger", "tombstones.json"),
    "utf8",
  ).toString() || "[]",
);
const re = await svc.rpc("reapply_tombstones", { p_ledger: ledger });
assert.equal(re.error, null);
const { error: probe } = await createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
)
  .from("products")
  .select("sku")
  .limit(1);
assert.equal(probe, null, "service answers after restore");
const r3 = t();

// 4. Verify.
const after = counts();
const diff = Object.keys(before).filter((k) => before[k] !== after[k]);
assert.deepEqual(
  diff,
  [],
  `row counts differ: ${diff.map((k) => `${k} ${before[k]}→${after[k]}`).join(", ")}`,
);
assert.equal(
  sql(
    `select string_agg(action, ',') from audit_log where entity_id = '${tag}'`,
  ),
  "before-backup",
  "post-backup write lost (RPO)",
);
const acc = JSON.parse(readFileSync(".accounts.local.json", "utf8")).brand;
const user = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
assert.equal(
  (await user.auth.signInWithPassword(acc)).error,
  null,
  "existing account signs in after restore",
);
for (const o of objects) {
  const [bucket, name] = o.split("|");
  const { data } = await svc.storage.from(bucket).download(name);
  assert.ok(
    Buffer.from(await data.arrayBuffer()).equals(
      readFileSync(join(dir, "files", bucket, name)),
    ),
    `bytes ${bucket}/${name}`,
  );
}
const owner = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  opts,
);
assert.equal((await owner.auth.signInWithPassword(creator)).error, null);
const signed = await owner.storage
  .from("private-uploads")
  .createSignedUrl(upPath, 60);
assert.equal(signed.error, null, "owner can sign the restored private file");
assert.ok(
  Buffer.from(await (await fetch(signed.data.signedUrl)).arrayBuffer()).equals(
    png,
  ),
  "restored file bytes via owner URL",
);
assert.ok(
  Object.values(re.data).every((n) => n === 0),
  `tombstones already consistent: ${JSON.stringify(re.data)}`,
);

const result = {
  backup: {
    seconds: backupSecs,
    db_sql_bytes: statSync(join(dir, "db.sql")).size,
    files: objects.length,
    rows: Object.values(before).reduce((a, b) => a + b, 0),
  },
  rpo: {
    backup_to_disaster_seconds: Math.round((disasterAt - backupAt) / 100) / 10,
    lost_writes: 1,
    policy: "daily manual dump → RPO ≤ 24h",
  },
  rto: {
    schema_recreate_seconds: schemaSecs,
    db_restore: secs(r0, r1),
    files: secs(r1, r2),
    tombstones_and_probe: secs(r2, r3),
    data_total_seconds: secs(r0, r3),
  },
  reapply: re.data,
};
writeFileSync(join(dir, "result.json"), JSON.stringify(result, null, 2));
console.log("PASS restore drill", JSON.stringify(result));
