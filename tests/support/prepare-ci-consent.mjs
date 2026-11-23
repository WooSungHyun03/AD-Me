import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { qaSignupConsent } from "./consent-fixture.mjs";

const entry = readFileSync(".env.local", "utf8").match(
  /^NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/m,
);
assert.ok(entry, "Missing local Supabase URL");
const url = new URL(entry[1].trim());
assert.ok(
  url.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(url.hostname) &&
    url.pathname === "/" &&
    !url.username &&
    !url.password &&
    !url.search,
  "QA consent setup requires a loopback Supabase URL",
);
const ports = execFileSync(
  "docker",
  ["port", "supabase_kong_AD-Me", "8000/tcp"],
  { encoding: "utf8" },
);
assert.ok(
  ports
    .trim()
    .split("\n")
    .some((address) => address.endsWith(":" + url.port)),
  "QA Supabase container does not match the configured port",
);
const { policy_version, policy_hash } = qaSignupConsent;
assert.match(policy_version, /^[a-z0-9-]+$/);
assert.match(policy_hash, /^[a-f0-9]{64}$/);
execFileSync(
  "docker",
  [
    "exec",
    "-i",
    "supabase_db_AD-Me",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  {
    input: `select adme_consent.approve('${policy_version}', '${policy_hash}', 'FICTIONAL LOCAL QA ONLY; no legal approval');\n`,
  },
);
console.log(
  "Enabled the fictional consent policy in the disposable CI database.",
);
