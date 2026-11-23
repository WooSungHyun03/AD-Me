// Exact disposable container and generated console SQL; no hosted credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const sql = (input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_dev-a-packet-db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
assert.match(
  readFileSync("output/dev-a-packet-db/supabase/config.toml", "utf8"),
  /^project_id = "dev-a-packet-db"$/m,
);
const mode = process.argv[2] ?? "955bf8c";
assert.ok(["955bf8c", "main", "integrated_dev_a"].includes(mode));
function applySource(name) {
  let body = readFileSync(`supabase/migrations/${name}`, "utf8");
  const at = body.toLowerCase().lastIndexOf("commit;");
  assert.ok(at >= 0);
  const [version, ...parts] = name.slice(0, -4).split("_");
  sql(
    body.slice(0, at) +
      `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${parts.join("_")}',array[$migration$${body}$migration$]);\n` +
      body.slice(at),
  );
}
if (mode !== "955bf8c") {
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "3",
  );
  if (mode === "integrated_dev_a")
    for (const name of readdirSync("supabase/migrations")
      .filter((n) => /^20261119000[4-7]_/.test(n))
      .sort())
      applySource(name);
  for (const name of readdirSync("supabase/migrations")
    .filter((n) => /^20261120000[1-5]_/.test(n))
    .sort())
    applySource(name);
} else
  assert.equal(
    sql("select count(*) from supabase_migrations.schema_migrations;"),
    "16",
  );
const beforeRows = sql(
  "select coalesce(md5(string_agg(id::text||brief::text,',' order by id)),'empty') from public.campaigns;",
);
const beforeControls =
  mode === "955bf8c"
    ? sql(
        "select ingestion_enabled::text||','||llm_enabled::text from adme_ops.resource_controls;",
      )
    : null;
const label = "from_" + mode;
const base = "deliverables/dev-a-terms-20261120/user-apply/";
// The two other baseline choices must fail before any mutating apply statement.
for (const variant of [
  "from_main",
  "from_integrated_dev_a",
  "from_955bf8c",
].filter((v) => v !== label))
  assert.throws(
    () => sql(readFileSync(`${base}00_preflight_${variant}.sql`, "utf8")),
    (e) => /STOP:/.test(e.stderr?.toString() ?? ""),
  );
sql(readFileSync(`${base}01_apply_${label}.sql`, "utf8"));
sql(readFileSync(`${base}02_verify.sql`, "utf8"));
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "18",
);
assert.equal(
  sql(
    "select convalidated::text from pg_constraint where conrelid='public.campaigns'::regclass and conname='campaign_terms_valid';",
  ),
  "true",
);
assert.equal(
  sql(
    "select provolatile::text||','||prosecdef::text from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure;",
  ),
  "v,false",
);
assert.equal(
  sql(
    "select coalesce(md5(string_agg(id::text||brief::text,',' order by id)),'empty') from public.campaigns;",
  ),
  beforeRows,
);
const flags = sql(
  "select ingestion_enabled::text||','||llm_enabled::text from adme_ops.resource_controls;",
);
assert.equal(flags, beforeControls ?? "false,false");
assert.throws(
  () => sql(readFileSync(`${base}00_preflight_${label}.sql`, "utf8")),
  (e) => /STOP:/.test(e.stderr?.toString() ?? ""),
);
writeFileSync(
  `output/dev-a-packet-db/continuation-${label}.local.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      baseline: label,
      result: "PASS",
      migration_count: 18,
      legacy_briefs_unchanged: true,
      resource_controls_preserved_or_default_off: true,
      wrong_baselines_rejected: true,
      reapply_rejected: true,
      no_hosted_access: true,
    },
    null,
    2,
  ),
);
console.log(
  `PASS continuation USER SQL ${label}:18 migrations, exact legacy briefs, volatile invoker getter, wrong/duplicate baseline denial`,
);
