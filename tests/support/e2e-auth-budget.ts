// D084: shared fixture accounts log in through the real D076 budget (10/account, 20/IP per minute).
// A fast full run exceeds it and later specs stall on "요청이 많습니다". The limit itself is covered by DB suites,
// so during E2E we clear only login windows in the disposable local DB. Never runs against a remote URL.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export default function globalSetup() {
  const url = process.env.BASE_URL || "http://localhost:3000";
  if (!/^http:\/\/(localhost|127\.0\.0\.1):/.test(url)) return;
  const project = /^project_id\s*=\s*"([^"]+)"/m.exec(
    readFileSync("supabase/config.toml", "utf8"),
  )?.[1];
  if (!project) return;
  const clear = () => {
    try {
      execFileSync(
        "docker",
        [
          "exec",
          `supabase_db_${project}`,
          "psql",
          "-U",
          "postgres",
          "-qtAc",
          "delete from adme_ops.rate_windows where scope in('auth_ip_login','auth_account_login')",
        ],
        { stdio: "ignore" },
      );
    } catch {} // no local DB (keyless run): nothing to clear
  };
  clear();
  const timer = setInterval(clear, 3000);
  return () => clearInterval(timer);
}
