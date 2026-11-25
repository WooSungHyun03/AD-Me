import { spawn, spawnSync } from "node:child_process";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
import { resolve } from "node:path";
import { startLocalTls } from "./local-tls-proxy.mjs";
import { enableLocalConsent } from "../tests/support/consent-fixture.mjs";
import { enableLocalIngestionPolicy } from "../tests/support/ingestion-fixture.mjs";
import { enableLocalDeletionIntake } from "../tests/support/deletion-fixture.mjs";
const runtime = localRuntime();
enableLocalConsent();
enableLocalIngestionPolicy();
enableLocalDeletionIntake();
const freeBeta = process.env.ADME_QA_MODE === "free_beta";
// Exact marked loopback DB only; public source/env flags cannot enable this gate.
sql(
  `begin; select adme_release.set_test_billing(${!freeBeta},'local-fictional-qa-only'); select adme_release.set_demo_catalog(${!freeBeta},'local-fictional-qa-only'); commit;`,
);
const env = {
  ...process.env,
  NEXT_PUBLIC_APP_URL: "https://127.0.0.1:3143",
  NEXT_PUBLIC_SUPABASE_URL: "https://127.0.0.1:54325",
  NODE_EXTRA_CA_CERTS: resolve("output/dev-a-db/tls.local.crt"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: runtime.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: runtime.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_TOSS_CLIENT_KEY: freeBeta ? "" : "test_ck_local_fixture_only",
  ADME_SERVICE_MODE: freeBeta ? "free_beta" : "test_demo",
  ADME_FEATURE_MAIL: "on",
  ADME_FEATURE_TEST_BILLING: freeBeta ? "off" : "on",
  ADME_FEATURE_INGESTION: "on",
  ADME_FEATURE_LLM: "on",
};
// The marked runtime names its own API port; never proxy to another checkout's stack.
const servers = startLocalTls(Number(new URL(runtime.API_URL).port));
// Build does not contact the Auth API except prerendered public data routes, which read request cookies.
const build = spawnSync(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { env, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    "3102",
  ],
  { env, stdio: "inherit" },
);
child.on("exit", (code) => {
  servers.forEach((server) => server.close());
  process.exit(code ?? 1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
