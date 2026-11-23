// Reuse the previously guarded exact local reset helper; never accepts a project path.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const mode = process.argv[2];
assert.ok(
  ["current_19", "main_8", "integrated_12", "previous_16", "terms_18"].includes(
    mode,
  ),
);
execFileSync(
  process.execPath,
  [
    "scripts/prepare-schema-packet-baseline.mjs",
    mode === "current_19" ? "terms_18" : mode,
  ],
  { stdio: "inherit" },
);
if (mode === "current_19") {
  const body = readFileSync(
    "supabase/migrations/202611200013_creator_identity.sql",
    "utf8",
  );
  const at = body.toLowerCase().lastIndexOf("commit;");
  assert.ok(at > 0);
  assert.ok(!body.includes("$read_base$"));
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
    {
      input:
        body.slice(0, at) +
        `insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200013','creator_identity',array[$read_base$${body}$read_base$]);\n` +
        body.slice(at),
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
}
