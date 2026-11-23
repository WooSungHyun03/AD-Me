// D087: representative load against a running production build + local isolated Supabase, then a capacity check
// of creator search at 10,000 synthetic rows (labeled demo, removed afterwards).
//   BASE_URL=http://localhost:3100 node tests/load/load.mjs
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .trim()
    .split("\n")
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
assert.match(
  env.NEXT_PUBLIC_SUPABASE_URL,
  /^http:\/\/(127\.0\.0\.1|localhost):/,
  "local isolated Supabase only",
);
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
assert.match(
  BASE,
  /^http:\/\/(127\.0\.0\.1|localhost):/,
  "never load-test a public URL from here",
);
const anon = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const sql = (q) =>
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
      "-qtA",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const pct = (xs, p) =>
  xs.slice().sort((a, b) => a - b)[
    Math.min(xs.length - 1, Math.ceil((p / 100) * xs.length) - 1)
  ];

async function run(name, n, concurrency, fn) {
  const ms = [];
  let errors = 0,
    i = 0;
  const started = performance.now();
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (i < n) {
        i++;
        const t = performance.now();
        try {
          if (!(await fn())) errors++;
        } catch {
          errors++;
        }
        ms.push(performance.now() - t);
      }
    }),
  );
  const r = {
    name,
    n,
    concurrency,
    p50: Math.round(pct(ms, 50)),
    p95: Math.round(pct(ms, 95)),
    max: Math.round(Math.max(...ms)),
    rps: Math.round((n / (performance.now() - started)) * 1000),
    errors,
  };
  console.log(JSON.stringify(r));
  return r;
}
const page = (path) => async () => (await fetch(BASE + path)).status === 200;
const search = (args) => async () =>
  !(await anon.rpc("search_creators", { p_include_demo: true, ...args })).error;

// Warm up compiled routes.
for (const p of ["/", "/creators", "/campaigns", "/api/health"])
  await fetch(BASE + p);
const results = [];
results.push(await run("GET / (landing)", 200, 10, page("/")));
results.push(
  await run("GET /creators (search page)", 200, 10, page("/creators")),
);
results.push(
  await run(
    "GET /creators?q=뷰티",
    200,
    10,
    page("/creators?q=%EB%B7%B0%ED%8B%B0"),
  ),
);
results.push(await run("GET /campaigns", 200, 10, page("/campaigns")));
results.push(await run("GET /api/health", 300, 20, page("/api/health")));
results.push(await run("RPC search_creators (name)", 300, 20, search({})));

// Capacity: 10,000 synthetic published demo creators cloned from a valid demo DTO.
const base = sql(
  `select profile::text from creators where published and (profile->>'is_demo')::boolean limit 1`,
);
assert.ok(base, "a published demo creator exists");
sql(`insert into creators(id, owner_id, published, profile)
  select 'load-' || g, null, true,
    jsonb_set(jsonb_set('${base.replace(/'/g, "''")}'::jsonb, '{name}', to_jsonb('부하 데모 ' || g)), '{followers}', to_jsonb(g * 37 % 900000))
  from generate_series(1, 10000) g`);
const rows = Number(sql(`select count(*) from creators`));
const bytesPerRow = Number(
  sql(
    `select round(pg_total_relation_size('creators') / count(*)) from creators`,
  ),
);
sql(`analyze creators`);
const plan = sql(
  `set role anon; explain select * from search_creators(p_q => '부하 데모 77', p_include_demo => true)`,
);
results.push(
  await run(`RPC search_creators name @${rows} rows`, 300, 20, search({})),
);
results.push(
  await run(
    `RPC search_creators followers @${rows} rows`,
    300,
    20,
    search({ p_sort: "followers" }),
  ),
);
results.push(
  await run(
    `RPC search_creators q='부하 데모 77' @${rows} rows`,
    300,
    20,
    search({ p_q: "부하 데모 77" }),
  ),
);
results.push(
  await run(`GET /creators @${rows} rows`, 200, 10, page("/creators")),
);
const qplan = sql(
  `explain (format text) select id from creators c where published and creator_search_text(c.profile) ilike '%부하 데모 77%'`,
);
sql(`delete from creators where id like 'load-%'`);

const budgets = { page: 1000, rpc: 300 }; // p95 budgets (ms) on the local stack
const failed = results.filter(
  (r) =>
    r.errors > 0 ||
    r.p95 > (r.name.startsWith("RPC") ? budgets.rpc : budgets.page),
);
const report = {
  at: new Date().toISOString(),
  base: BASE,
  budgets,
  results,
  capacity: {
    rows,
    bytes_per_creator_row: bytesPerRow,
    creators_per_500mb_estimate: Math.floor(
      (500 * 1024 ** 2 * 0.5) / bytesPerRow,
    ),
    trigram_index_used: /creators_pub_search/.test(qplan),
  },
  plan: plan.split("\n")[0],
};
mkdirSync("harness/evidence/D087", { recursive: true });
writeFileSync(
  "harness/evidence/D087/load-report.json",
  JSON.stringify(report, null, 2),
);
assert.deepEqual(
  failed.map((r) => r.name),
  [],
  "p95 budget or error",
);
console.log("PASS load", JSON.stringify(report.capacity));
