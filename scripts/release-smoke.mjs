// D088: anonymous, read-only release smoke. GET requests only, no sign-in, no cookies, no writes.
// Usage: node scripts/release-smoke.mjs <base URL> [--commit <sha>] [--deployment <id>] [--out <file>]
// --commit/--deployment are what the operator says was deployed; they are recorded as operator-reported,
// because the public health endpoint deliberately exposes only {status} (D086).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { SMOKE_CHECKS, summarize } from "../src/lib/release-smoke.ts";

const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = process.argv[2];
if (!base || !/^https?:\/\/[^/]+$/.test(base.replace(/\/$/, ""))) {
  console.error(
    "Usage: node scripts/release-smoke.mjs <https://host> [--out file]",
  );
  process.exitCode = 2;
} else {
  const origin = base.replace(/\/$/, "");
  const https = origin.startsWith("https://");
  const cache = new Map();
  const get = async (path) => {
    if (!cache.has(path)) {
      const res = await fetch(origin + path, {
        redirect: "manual",
        headers: { "user-agent": "adme-release-smoke" },
        signal: AbortSignal.timeout(60_000),
      });
      const body = (await res.text()).slice(0, 200_000);
      cache.set(path, {
        status: res.status,
        headers: Object.fromEntries(
          [...res.headers].map(([k, v]) => [k.toLowerCase(), v]),
        ),
        body,
      });
    }
    return cache.get(path);
  };
  const results = [];
  for (const c of SMOKE_CHECKS) {
    let r;
    try {
      r = await get(c.path);
    } catch {
      r = { status: 0, headers: {}, body: "" };
    }
    results.push({
      id: c.id,
      path: c.path,
      expect: c.expect,
      ok: c.judge(r, https),
      status: r.status,
    });
  }
  const report = {
    target: origin,
    checkedAt: new Date().toISOString(),
    operatorReported: {
      commit: arg("--commit") ?? null,
      deployment: arg("--deployment") ?? null,
    },
    scope:
      "anonymous read-only GET; role flows, real data, Toss TEST and mobile UI are separate gates",
    ...summarize(results),
    results,
  };
  const out = arg("--out");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  }
  console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
  for (const r of results)
    if (!r.ok) console.log(`FAIL ${r.id} (${r.status}) expected ${r.expect}`);
  process.exitCode = report.verdict === "PASS" ? 0 : 3;
}
