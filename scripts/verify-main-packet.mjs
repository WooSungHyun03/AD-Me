// Developer-only: exact disposable packet container. Never reads hosted credentials.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
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
const integrated = process.argv.includes("--integrated");
assert.equal(
  sql(
    "select count(*) from supabase_migrations.schema_migrations where version between '202611190004' and '202611190007';",
  ),
  integrated ? "4" : "0",
);
assert.equal(
  sql(
    "select count(*) from supabase_migrations.schema_migrations where version like '20261120%';",
  ),
  "0",
);
for (const name of readdirSync("supabase/migrations")
  .filter((n) => /^20261120000[1-5]_/.test(n))
  .sort()) {
  let body = readFileSync(`supabase/migrations/${name}`, "utf8");
  const at = body.toLowerCase().lastIndexOf("commit;");
  assert.ok(at >= 0);
  const [version, ...parts] = name.slice(0, -4).split("_");
  body =
    body.slice(0, at) +
    `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${parts.join("_")}',array[$body$${body}$body$]);\n` +
    body.slice(at);
  sql(body);
}
const label = integrated ? "from_integrated_dev_a" : "from_main";
const base = "deliverables/dev-a-main-20261120/user-apply/";
sql(readFileSync(`${base}01_apply_${label}.sql`, "utf8"));
sql(readFileSync(`${base}02_verify.sql`, "utf8"));
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "16",
);
assert.equal(
  sql(
    "select (not ingestion_enabled and not llm_enabled)::text from adme_ops.resource_controls;",
  ),
  "true",
);
assert.equal(
  sql("select discovery_enabled::text from adme_ops.settings;"),
  "false",
);
assert.equal(
  sql(
    "select bool_and(relrowsecurity)::text from pg_class where oid in ('adme_ops.resource_controls'::regclass,'adme_ops.rate_windows'::regclass);",
  ),
  "true",
);
assert.equal(
  sql(
    "select has_function_privilege('authenticated','adme_ops.provision_staff(uuid,text,text,timestamptz)','execute')::text;",
  ),
  "false",
);
assert.throws(
  () => sql(readFileSync(`${base}00_preflight_${label}.sql`, "utf8")),
  (error) => /STOP:/.test(error.stderr?.toString() ?? ""),
);
writeFileSync(
  `output/dev-a-packet-db/${label}-verification.local.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      baseline: label,
      result: "PASS",
      migration_count: 16,
      flags_default_off: true,
      rls: true,
      browser_provision: false,
      reapply_rejected: true,
      no_hosted_access: true,
    },
    null,
    2,
  ),
);
console.log(
  `PASS actual USER console SQL ${label}:16 migrations, default-off, private RLS/privileges and reapply rejection`,
);
