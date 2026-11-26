// D024: real-data pilot quality report. Calls the service-role RPC public.pilot_quality_samples()
// and writes an aggregate report (opaque sample refs only, no channel ids or titles).
// Usage: node scripts/pilot-quality-report.mjs [--env .env.local] [--out docs/evidence/data-pilot/<file>.json]
// The service role key is read from the env file or process.env and is never printed or written.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { assessPilot } from "../src/lib/pilot-quality.ts";
import { assertSourceAllowed, policies } from "../src/lib/ingestion/policy.ts";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const envFile = arg("--env") ?? ".env.local";
let fileEnv = {};
try {
  fileEnv = Object.fromEntries(
    readFileSync(envFile, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
} catch {} // env may come from process.env only
const env = { ...fileEnv, ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
  );
  process.exit(2);
}
let approved = true;
try {
  assertSourceAllowed("youtube_data_api");
} catch {
  approved = false; // U001 not recorded in src/lib/ingestion/policy.ts
}
const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db.rpc("pilot_quality_samples");
// Set exitCode instead of process.exit(): exiting with the client's handles open aborts libuv on Windows.
if (error) {
  console.error(
    `pilot_quality_samples failed: ${error.code ?? ""} ${error.message}`,
  );
  process.exitCode = 1;
} else {
  const report = {
    environment: new URL(url).host,
    ...assessPilot(data, {
      approved,
      refreshDays: policies.youtube_data_api.refresh_days,
    }),
  };
  const out = arg("--out");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  }
  const { samples, ...summary } = report;
  console.log(
    JSON.stringify({ ...summary, sampleCount: samples.length }, null, 2),
  );
  process.exitCode = report.gate === "MET" ? 0 : 3;
}
