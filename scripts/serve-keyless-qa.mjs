import { spawn, spawnSync } from "node:child_process";
const env = { ...process.env, NEXT_PUBLIC_APP_URL: "", NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NEXT_PUBLIC_TOSS_CLIENT_KEY: "",
  ADME_SERVICE_MODE: "free_beta", ADME_FEATURE_MAIL: "off", ADME_FEATURE_TEST_BILLING: "off",
  ADME_FEATURE_INGESTION: "off", ADME_FEATURE_LLM: "off", CIRCLE_NODE_TOTAL: "2" };
const build = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"], { env, stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
