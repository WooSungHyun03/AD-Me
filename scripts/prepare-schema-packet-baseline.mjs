// Developer-only reset of the explicitly named disposable packet DB. No hosted CLI command.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const target = resolve("output/dev-a-packet-db");
assert.equal(target, resolve("C:/projects/AD-Me/output/dev-a-packet-db"));
const config = readFileSync(`${target}/supabase/config.toml`, "utf8");
assert.match(config, /^project_id = "dev-a-packet-db"$/m);
assert.match(config, /\[db\]\s*#[^\n]*\nport = 54332/m);
assert.deepEqual(readdirSync(`${target}/supabase/migrations`).sort(), [
  "202611190001_core.sql",
  "202611190002_operations.sql",
  "202611190003_json_contracts.sql",
]);
const mode = process.argv[2];
assert.ok(
  ["main_8", "integrated_12", "previous_16", "terms_18"].includes(mode),
);
const reset = spawnSync(
  process.env.ComSpec ?? "cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    "npm exec --yes --package=supabase@3.2.0 -- supabase db reset --local --workdir output/dev-a-packet-db --yes",
  ],
  { encoding: "utf8" },
);
writeFileSync(
  `${target}/schema-reset-${mode}.local.log`,
  `${reset.stdout ?? ""}\n${reset.stderr ?? ""}`,
);
assert.equal(
  reset.status,
  0,
  "Inspect ignored packet reset log; never publish credentials",
);
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
assert.equal(
  sql("select count(*) from supabase_migrations.schema_migrations;"),
  "3",
);
const versions = [];
if (mode !== "main_8")
  versions.push("202611190004", "202611190005", "202611190006", "202611190007");
versions.push(
  "202611200001",
  "202611200002",
  "202611200003",
  "202611200004",
  "202611200005",
);
if (["previous_16", "terms_18"].includes(mode))
  versions.push("202611200006", "202611200007", "202611200008", "202611200010");
if (mode === "terms_18") versions.push("202611200011", "202611200012");
for (const version of versions) {
  const names = readdirSync("supabase/migrations").filter((n) =>
    n.startsWith(`${version}_`),
  );
  assert.equal(names.length, 1);
  const body = readFileSync(`supabase/migrations/${names[0]}`, "utf8");
  const marker = "$baseline_source$";
  assert.ok(!body.includes(marker));
  const at = body.toLowerCase().lastIndexOf("commit;");
  assert.ok(at >= 0);
  const name = names[0].slice(version.length + 1, -4);
  sql(
    body.slice(0, at) +
      `insert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array[${marker}${body}${marker}]);\n` +
      body.slice(at),
  );
}
console.log(
  `Prepared ${mode} in exact local disposable packet DB; migration count ${sql("select count(*) from supabase_migrations.schema_migrations;")}.`,
);
