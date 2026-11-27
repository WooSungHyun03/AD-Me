// D086: operator alert drill. Sends ONE clearly labelled test message through the same alert() path the
// server uses, so U018 can confirm the channel receives alerts without faking an outage.
// Usage: node scripts/alert-drill.mjs [--env .env.local] [--out harness/evidence/D086/<date>/alert-drill.json]
// ALERT_WEBHOOK_URL comes from the env file or process.env. The URL (its path is the secret) is never
// printed or written: the report keeps only the channel kind and the delivery result.
// Exit codes: 0 sent, 2 not configured, 3 delivery failed.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { alert } from "../src/lib/observability.ts";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
try {
  const lines = readFileSync(arg("--env") ?? ".env.local", "utf8").split(
    /\r?\n/,
  );
  for (const l of lines) {
    if (!l.includes("=") || l.startsWith("#")) continue;
    const name = l.slice(0, l.indexOf("="));
    // Only the two names the drill needs; process.env wins over the file.
    if (["ALERT_WEBHOOK_URL", "SERVICE_MODE"].includes(name))
      process.env[name] ??= l.slice(l.indexOf("=") + 1).trim();
  }
} catch {} // env may come from process.env only

const channel = (() => {
  try {
    const host = new URL(process.env.ALERT_WEBHOOK_URL ?? "").hostname;
    if (host === "hooks.slack.com") return "slack";
    if (/(^|\.)discord(app)?\.com$/.test(host)) return "discord";
    if (["127.0.0.1", "localhost"].includes(host)) return "local";
    return "other";
  } catch {
    return "none";
  }
})();
const checkedAt = new Date().toISOString();
// A unique key per run, so the 10-minute dedupe never hides a drill.
const result = await alert(
  `drill:${checkedAt}`,
  `[DRILL] 모의 장애 알림입니다. 실제 장애가 아닙니다. 수신되면 U018 알림 채널 설정이 동작합니다. (${checkedAt})`,
);
const report = {
  drill: true,
  checkedAt,
  serviceMode: process.env.SERVICE_MODE ?? "free_beta",
  channel,
  result,
  note:
    result === "sent"
      ? "The webhook accepted the message; confirm it appears in the channel and attach a screenshot."
      : result === "not_configured"
        ? "ALERT_WEBHOOK_URL is missing or not https."
        : "The webhook did not accept the message (non-2xx, timeout or network error).",
};
const out = arg("--out");
if (out) {
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
process.exitCode = result === "sent" ? 0 : result === "not_configured" ? 2 : 3;
