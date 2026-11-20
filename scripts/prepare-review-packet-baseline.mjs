import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const count = Number(process.argv[2]);
assert.ok([23, 24].includes(count));
execFileSync(
  process.execPath,
  ["scripts/prepare-read-packet-baseline.mjs", "current_19"],
  { stdio: "inherit" },
);
execFileSync(
  process.execPath,
  ["scripts/verify-read-boundary-packet.mjs", "current_19"],
  { stdio: "inherit" },
);
if (count === 24)
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
      input: readFileSync("deliverables/dev-a-messages-20261120.sql", "utf8"),
      encoding: "utf8",
      stdio: ["pipe", "ignore", "pipe"],
    },
  );
console.log(`Prepared exact local packet${count} baseline.`);
