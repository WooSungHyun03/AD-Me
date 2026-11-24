// D087: backup → disaster → restore drill on the LOCAL isolated Supabase only. Measures RPO/RTO and verifies
// row counts, a pre-backup marker present, a post-backup marker lost (= RPO), Auth sign-in, Storage file bytes,
// and tombstone re-application. The backup format is the one a Free-plan user can make themselves:
// a data-only pg_dump (application data, Auth and bucket definitions) plus a Storage API export.
//   node harness/restore_drill.mjs [backupDir]
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";

const workdir = resolve(process.env.ADME_RESTORE_WORKDIR ?? ".");
const config = readFileSync(join(workdir, "supabase/config.toml"), "utf8");
const project = /^project_id\s*=\s*"([\w-]+)"/m.exec(config)?.[1];
assert.ok(project, "Expected a local Supabase project ID");
const database = `supabase_db_${project}`;
const gateway = `supabase_kong_${project}`;
const env = parseEnv(readFileSync(".env.local", "utf8"));
const api = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
assert.match(api.origin, /^http:\/\/(127\.0\.0\.1|localhost):\d+$/);
const listeners = execFileSync("docker", ["port", gateway, "8000/tcp"], {
  encoding: "utf8",
}).trim().split("\n");
assert.ok(
  listeners.some((listener) => listener.endsWith(`:${api.port}`)),
  "Backup, reset and file operations must target the same isolated stack",
);
const dir = resolve(process.argv[2] ?? `backups/drill-${crypto.randomUUID()}`);
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
      database,
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
    `select format('%I.%I', schemaname, tablename)
     from pg_tables where schemaname = 'public'
        or left(schemaname, 5) = 'adme_' order by 1`,
  ).split("\n");
const counts = () =>
  Object.fromEntries(
    tables().map((table) => [table, Number(sql(`select count(*) from ${table}`))]),
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
mkdirSync(dirname(dir), { recursive: true, mode: 0o700 });
mkdirSync(dir, { mode: 0o700 });
mkdirSync(join(dir, "files"));
const b0 = t();
const dump = execFileSync(
  "docker",
  [
    "exec",
    database,
    "pg_dump",
    "-U",
    "supabase_admin",
    "-d",
    "postgres",
    "--data-only",
    "-t",
    "public.*",
    "-t",
    "adme_*.*",
    "-t",
    "auth.users",
    "-t",
    "auth.identities",
    "-t",
    "storage.buckets",
  ],
  { maxBuffer: 1 << 28 },
);
writeFileSync(join(dir, "db.sql"), dump);
const dumped = new Set(
  [...dump.toString().matchAll(/^COPY (\S+) /gm)].map((m) =>
    m[1].replaceAll('"', ""),
  ),
);
assert.deepEqual(
  tables().filter((x) => !dumped.has(x)),
  [],
  "every application table is in the dump",
);
const objects = JSON.parse(sql(
  `select coalesce(json_agg(json_build_object(
     'bucket', bucket_id, 'name', name,
     'contentType', coalesce(metadata->>'mimetype', 'application/octet-stream')
   ) order by bucket_id, name), '[]') from storage.objects`,
));
const objectFile = ({ bucket, name }) => {
  assert.match(bucket, /^[a-zA-Z0-9_-]+$/);
  assert.ok(name.split("/").every((part) => part && part !== "." && part !== ".."));
  return join(dir, "files", bucket, name);
};
for (const object of objects) {
  const { bucket, name } = object;
  const { data, error } = await svc.storage.from(bucket).download(name);
  assert.equal(error, null, `download ${bucket}/${name}`);
  const p = objectFile(object);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, Buffer.from(await data.arrayBuffer()));
}
const ledgerFile = join(dir, "files", "privacy-ledger", "tombstones.json");
if (!existsSync(ledgerFile)) {
  const { data, error } = await svc.rpc("tombstone_ledger");
  assert.equal(error, null, "export current tombstones");
  mkdirSync(dirname(ledgerFile), { recursive: true });
  writeFileSync(ledgerFile, JSON.stringify(data));
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
for (const { bucket, name } of objects) {
  const { error } = await svc.storage.from(bucket).remove([name]);
  assert.equal(error, null, `remove before reset ${bucket}/${name}`);
}
assert.equal(sql("select count(*) from storage.objects"), "0");

const disasterAt = Date.now();
const z0 = t();
const cli = process.env.ADME_RESTORE_CLI;
execFileSync(
  cli ?? "npx",
  [...(cli ? [] : ["--yes", `supabase@${process.env.SUPABASE_CLI_VERSION ?? "2.122.1"}`]), "db", "reset", "--local", "--no-seed", "--workdir", workdir],
  { stdio: "inherit" },
);
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
   truncate ${tables().join(", ")}, auth.identities, auth.users, storage.buckets cascade;
   ${readFileSync(join(dir, "db.sql"), "utf8")}`,
  "supabase_admin",
);
const r1 = t();
// Storage creates the object row at the same time as the bytes. Restoring
// object rows through SQL first creates metadata pointing to missing files.
for (const object of objects) {
  const { bucket, name, contentType } = object;
  const body = readFileSync(objectFile(object));
  const { error } = await svc.storage.from(bucket).upload(name, body, { contentType });
  assert.equal(error, null, `re-upload ${bucket}/${name}`);
}
const r2 = t();
const ledger = JSON.parse(readFileSync(ledgerFile, "utf8"));
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
for (const object of objects) {
  const { bucket, name } = object;
  const { data, error } = await svc.storage.from(bucket).download(name);
  assert.equal(error, null, `download after restore ${bucket}/${name}`);
  assert.ok(
    Buffer.from(await data.arrayBuffer()).equals(
      readFileSync(objectFile(object)),
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
