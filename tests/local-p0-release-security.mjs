import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const runtime = localRuntime(),
  ids = { brand: randomUUID(), creator: randomUUID() },
  creatorId = "user-" + ids.creator,
  anon = localClient(),
  brand = localClient(undefined, localJwt(ids.brand)),
  creator = localClient(undefined, localJwt(ids.creator)),
  service = localClient(runtime.SERVICE_ROLE_KEY),
  results = [];
const base = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
  literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const old = sql("select enabled from adme_release.billing_boundary;");
let order;
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const filters = {
  query: "",
  categories: [],
  platforms: [],
  tags: [],
  minPrice: "",
  maxPrice: "",
  minFollowers: "",
  maxFollowers: "",
  available: false,
  sort: "name",
};
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','fixture-only','{}','{"role":"${role}","name":"Fictional P0 QA"}',now(),now());`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile) values('${creatorId}','${ids.creator}',true,'${literal({ ...base, is_demo: false, metrics_source: "unavailable", owner_consent: false, name: "가상 로컬 P0 확인", private_note: "P0_PRIVATE_CANARY" })}');`,
  );
  await check(
    "home counts current public registration separately from DEMO and never exposes private profile data",
    async () => {
      const r = await anon.rpc("creator_home_summary", { p_demo: false });
      assert.equal(r.error, null);
      assert.equal(r.data.demo, 0);
      assert.equal(r.data.total, r.data.registered);
      assert.ok(r.data.total >= 1);
      assert.ok(r.data.featured.every((c) => !c.is_demo));
      assert.ok(!JSON.stringify(r.data).includes("owner_id"));
      assert.ok(!JSON.stringify(r.data).includes("P0_PRIVATE_CANARY"));
      sql(
        `update public.creators set published=false where id='${creatorId}';`,
      );
      const hidden = await anon.rpc("creator_home_summary", { p_demo: false });
      assert.equal(hidden.data.total, r.data.total - 1);
      sql(`update public.creators set published=true where id='${creatorId}';`);
    },
  );
  await check(
    "default-off database blocks direct TEST orders/finalization/products/HOT and clients cannot enable it",
    async () => {
      sql("select adme_release.set_test_billing(false,'local-p0-qa-only');");
      assert.equal(
        (await brand.rpc("create_test_order", { p_sku: "brand_pro" })).error
          ?.code,
        "PT404",
      );
      assert.equal(
        (
          await service.rpc("finalize_test_order", {
            p_order: randomUUID(),
            p_owner: ids.brand,
            p_payment_key: "fictional",
            p_amount: 49000,
          })
        ).error?.code,
        "PT404",
      );
      assert.deepEqual((await anon.from("products").select("sku")).data, []);
      assert.deepEqual((await anon.rpc("active_hot_creators")).data, []);
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_release.set_test_billing(boolean,text)','execute');`,
          ),
          "f",
        );
      assert.equal(
        sql(
          "select has_function_privilege('authenticated','adme_release.create_order_legacy(text)','execute');",
        ),
        "f",
      );
    },
  );
  await check(
    "owner TEST opt-in preserves exact catalog prices, role refusal, one entitlement on duplicate DB confirmation",
    async () => {
      sql("select adme_release.set_test_billing(true,'local-p0-qa-only');");
      const products = await anon
        .from("products")
        .select("sku,amount,credits,days");
      assert.equal(products.data.length, 7);
      for (const sku of ["search_run", "job_post"]) {
        const attempts = await Promise.all(
          Array.from({ length: 6 }, () =>
            brand.rpc("create_test_order", { p_sku: sku }),
          ),
        );
        assert.ok(attempts.every((r) => !r.error));
        assert.equal(new Set(attempts.map((r) => r.data.id)).size, 1);
        assert.equal(
          attempts[0].data.amount,
          products.data.find((p) => p.sku === sku).amount,
        );
        assert.equal(
          (await creator.rpc("create_test_order", { p_sku: sku })).error?.code,
          "42501",
        );
      }
      assert.equal(
        (await creator.rpc("create_test_order", { p_sku: "job_application" }))
          .error?.code,
        "42501",
      );
      assert.deepEqual(
        products.data.find((x) => x.sku === "ai_credits"),
        { sku: "ai_credits", amount: 4900, credits: 20, days: 30 },
      );
      assert.ok(
        (await creator.rpc("create_test_order", { p_sku: "brand_pro" })).error,
      );
      const r = await brand.rpc("create_test_order", { p_sku: "brand_pro" });
      assert.equal(r.error, null);
      order = r.data.id;
      assert.equal(r.data.amount, 49000);
      const args = {
        p_order: order,
        p_owner: ids.brand,
        p_payment_key: "fixture-no-provider-" + randomUUID(),
        p_amount: 49000,
      };
      const done = await service.rpc("finalize_test_order", args);
      assert.equal(done.error, null);
      const retry = await service.rpc("finalize_test_order", args);
      assert.equal(retry.data, done.data);
      assert.equal(
        (await brand.rpc("finalize_test_order", args)).error?.code,
        "42501",
      );
      sql("select adme_release.set_test_billing(false,'local-p0-qa-only');");
      assert.equal(
        (await brand.rpc("create_test_order", { p_sku: "brand_pro" })).error
          ?.code,
        "PT404",
      );
    },
  );
  await check(
    "filtered catalogue rejects forged inputs/bad cursor/GET bypass and preserves null versus zero followers",
    async () => {
      for (const f of [
        { ...filters, owner_id: ids.brand },
        { ...filters, sort: "random" },
        { ...filters, minPrice: "-1" },
        { ...filters, minFollowers: "3", maxFollowers: "0" },
        { ...filters, platforms: ["malicious"] },
      ])
        assert.ok(
          (await anon.rpc("creator_filter_page", { p_filters: f })).error,
        );
      assert.ok(
        (
          await anon.rpc("creator_filter_page", {
            p_filters: filters,
            p_cursor: "invalid",
          })
        ).error,
      );
      const rawGet = await fetch(
        `${runtime.API_URL}/rest/v1/rpc/creator_filter_page?p_filters=${encodeURIComponent(JSON.stringify(filters))}`,
        { headers: { apikey: runtime.ANON_KEY } },
      );
      assert.equal(rawGet.status, 405);
      const nulls = await anon.rpc("creator_filter_page", {
        p_filters: {
          ...filters,
          query: "가상 로컬 P0 확인",
          minFollowers: "0",
        },
      });
      assert.equal(nulls.error, null);
      assert.equal(nulls.data.total, 0);
    },
  );
  await check(
    "actual keyset search covers more than1000 equal-name rows without duplicates and binds cursor to filters",
    async () => {
      sql(
        `insert into public.creators(id,published,profile) select 'p0-bulk-'||lpad(n::text,4,'0'),true,'${literal({ ...base, name: "P0 Bulk Same Name", private_note: "P0_PRIVATE_CANARY" })}'::jsonb from generate_series(1,1050) n;`,
      );
      const f = { ...filters, query: "P0 Bulk Same Name" },
        seen = new Set();
      let cursor = null,
        firstCursor;
      do {
        const r = await anon.rpc("creator_filter_page", {
          p_filters: f,
          p_cursor: cursor,
          p_limit: 100,
          p_demo: true,
        });
        assert.equal(r.error, null);
        assert.equal(r.data.total, 1050);
        assert.ok(!JSON.stringify(r.data).includes("P0_PRIVATE_CANARY"));
        for (const c of r.data.items) {
          assert.ok(!seen.has(c.seed_id));
          seen.add(c.seed_id);
        }
        cursor = r.data.nextCursor;
        firstCursor ??= cursor;
      } while (cursor);
      assert.equal(seen.size, 1050);
      assert.ok(
        (
          await anon.rpc("creator_filter_page", {
            p_filters: { ...f, sort: "price" },
            p_cursor: firstCursor,
            p_demo: true,
          })
        ).error,
      );
    },
  );
} finally {
  sql(
    `delete from public.creators where id like 'p0-bulk-%' or id='${creatorId}';delete from public.entitlements where owner_id='${ids.brand}';delete from public.orders where owner_id='${ids.brand}';delete from adme_ops.rate_windows where subject in('${ids.brand}','${ids.creator}');delete from auth.users where id in('${ids.brand}','${ids.creator}');select adme_release.set_test_billing(${old === "t"},'local-p0-qa-restored');`,
  );
}
writeFileSync(
  "output/dev-a-db/p0-release-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      results,
      scope:
        "Actual local PostgreSQL/PostgREST, fictional users and local DB-only TEST confirmation; no Toss/provider/hosted validation",
    },
    null,
    2,
  ),
);
