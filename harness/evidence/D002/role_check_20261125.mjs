// D002 local-replica role check: screen catalog = DB products = server order amount.
// Usage: D002_API=http://127.0.0.1:<port> D002_DB_CONTAINER=<name> D002_ANON=.. D002_SERVICE=.. D002_JWT_SECRET=.. node harness/evidence/D002/role_check_20261125.mjs
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = process.env;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(env.D002_API ?? ""))
  throw new Error("D002 check refuses non-loopback infrastructure");
const sql = (q) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      env.D002_DB_CONTAINER,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: q, encoding: "utf8" },
  ).trim();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => {
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 600, aal: "aal2" })}`;
  return `${body}.${createHmac("sha256", env.D002_JWT_SECRET).update(body).digest("base64url")}`;
};
const client = (key, token) =>
  createClient(env.D002_API, key, {
    auth: { persistSession: false },
    global: token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined,
  });

const ids = { brand: randomUUID(), creator: randomUUID() };
for (const [role, id] of Object.entries(ids))
  sql(
    `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','fixture-only','{}','{"role":"${role}","name":"Fictional D002 QA"}',now(),now());`,
  );
const anon = client(env.D002_ANON),
  brand = client(env.D002_ANON, jwt(ids.brand)),
  creator = client(env.D002_ANON, jwt(ids.creator)),
  service = client(env.D002_SERVICE);
const prd = readFileSync("docs/PRD.md", "utf8");
const original = sql("select enabled from adme_release.billing_boundary;");
const results = [];
const check = async (name, run) => {
  await run();
  results.push(name);
  console.log("PASS " + name);
};
try {
  await check(
    "billing off (free beta): catalog hidden for every role and TEST order denied (PT404)",
    async () => {
      sql("select adme_release.set_test_billing(false,'d002-local-replica');");
      for (const c of [anon, brand, creator])
        assert.equal((await c.from("products").select("sku")).data.length, 0);
      assert.equal(
        (await brand.rpc("create_test_order", { p_sku: "ai_credits" })).error
          ?.code,
        "PT404",
      );
    },
  );
  sql("select adme_release.set_test_billing(true,'d002-local-replica');");
  await check(
    "anon/brand/creator read the same 7-SKU catalog; PRD credit prices match DB",
    async () => {
      const reads = await Promise.all(
        [anon, brand, creator].map((c) =>
          c.from("products").select("sku,amount,days,credits").order("sku"),
        ),
      );
      for (const r of reads) assert.equal(r.error, null);
      assert.equal(reads[0].data.length, 7);
      assert.deepEqual(reads[1].data, reads[0].data);
      assert.deepEqual(reads[2].data, reads[0].data);
      for (const p of reads[0].data.filter((p) => p.credits > 0))
        assert.ok(prd.includes(`${p.amount.toLocaleString("ko-KR")}원`), p.sku);
    },
  );
  await check(
    "brand/creator cannot rewrite product prices (denied, DB unchanged)",
    async () => {
      for (const c of [brand, creator]) {
        const r = await c
          .from("products")
          .update({ amount: 1 })
          .eq("sku", "ai_credits")
          .select();
        assert.ok(r.error || r.data.length === 0);
      }
      assert.equal(
        sql("select amount from public.products where sku='ai_credits';"),
        "4900",
      );
    },
  );
  await check(
    "billing on: server order amount = DB amount; opposite role denied; retry is idempotent",
    async () => {
      const o = await brand.rpc("create_test_order", { p_sku: "ai_credits" });
      assert.equal(o.error, null);
      assert.equal(o.data.amount, 4900);
      assert.equal(
        (await creator.rpc("create_test_order", { p_sku: "ai_credits" })).error
          ?.code,
        "42501",
      );
      const first = await brand.rpc("create_test_order", {
        p_sku: "search_run",
      });
      const again = await brand.rpc("create_test_order", {
        p_sku: "search_run",
      });
      assert.equal(first.error, null);
      assert.equal(again.data.id, first.data.id);
      assert.equal(first.data.amount, 3000);
      const args = {
        p_order: o.data.id,
        p_owner: ids.brand,
        p_payment_key: "fixture-no-provider-" + randomUUID(),
        p_amount: 4900,
      };
      assert.equal(
        (await brand.rpc("finalize_test_order", args)).error?.code,
        "42501",
      );
      const done = await service.rpc("finalize_test_order", args);
      assert.equal(done.error, null);
      assert.equal(
        (await service.rpc("finalize_test_order", args)).data,
        done.data,
      );
      assert.ok(
        (await service.rpc("finalize_test_order", { ...args, p_amount: 1 }))
          .error,
      );
      assert.equal(
        sql(`select credits from public.entitlements where id='${done.data}';`),
        "20",
      );
    },
  );
} finally {
  sql(
    `select adme_release.set_test_billing(${original === "t"},'d002-local-replica-restore');`,
  );
}
console.log(
  JSON.stringify({
    ticket: "D002",
    scope: "local replica fixture",
    passed: results.length,
  }),
);
