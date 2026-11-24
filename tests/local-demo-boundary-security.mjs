// Fictional loopback-only roles and data. No provider calls or hosted changes.
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
const a = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const roles = {
  anon: localClient(),
  ...Object.fromEntries(
    ["brand", "creator", "admin"].map((role) => [
      role,
      localClient(undefined, localJwt(a[role].id)),
    ]),
  ),
};
const creatorId = `d005-${randomUUID()}`,
  campaign = randomUUID(),
  legacyCampaign = randomUUID(),
  key = randomUUID();
const filters = {
  query: "",
  categories: [],
  platforms: [],
  tags: [],
  minPrice: "",
  maxPrice: "",
  minFollowers: "",
  maxFollowers: "",
  minEngagement: "",
  available: false,
  sort: "name",
};
const before = sql(
  "select md5(string_agg(id||profile::text,','order by id)) from public.creators where profile->'is_demo'='true'::jsonb",
);
const prior = Object.fromEntries(
  ["catalog_boundary", "billing_boundary"].map((table) => [
    table,
    sql(`select row_to_json(b) from adme_release.${table} b`),
  ]),
);
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
}
const rpc = async (client, name, args) => {
  const r = await client.rpc(name, args);
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
let snapshot;
try {
  sql(`insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${a.creator.id}',true,profile||'{"is_demo":false,"name":"D005 로컬 등록 QA","metrics_source":"unavailable","followers":0}'::jsonb from public.creators where id='creator-001';
  insert into public.campaigns(id,owner_id,brief,status,is_demo)select '${campaign}','${a.brand.id}',brief||'{"platforms":["youtube"]}'::jsonb,'published',false from public.campaigns limit 1;`);
  sql(
    `insert into public.campaigns(id,owner_id,brief,status,is_demo)select '${legacyCampaign}','${a.brand.id}',brief,'published',true from public.campaigns limit 1;`,
  );
  const reference = sql(`select adme_creator.public_reference('${creatorId}')`);
  await check(
    "OFF all public role DTO/search/count/home/campaign reads exclude DEMO even with forged include flags; real DTO survives",
    async () => {
      sql("select adme_release.set_demo_catalog(false,'local-d005-off-only')");
      for (const [role, client] of Object.entries(roles)) {
        assert.equal(
          await rpc(client, "creator_public_one", { p_ref: "creator-001" }),
          null,
        );
        const real = await rpc(client, "creator_public_one", {
          p_ref: reference,
        });
        assert.equal(real.is_demo, false);
        assert.equal(real.followers, null);
        assert.ok(!("owner_id" in real));
        const page = await rpc(client, "creator_catalog_page", {
          p_limit: 200,
        });
        assert.ok(page.items.every((c) => !c.is_demo));
        assert.ok(page.items.some((c) => c.seed_id === reference));
        const filtered = await rpc(client, "creator_filter_page", {
          p_filters: filters,
          p_demo: true,
        });
        assert.ok(filtered.items.every((c) => !c.is_demo));
        const summary = await rpc(client, "creator_home_summary", {
          p_demo: true,
        });
        assert.equal(summary.demo, 0);
        const legacy = await rpc(client, "search_creators", {
          p_include_demo: true,
          p_limit: 49,
        });
        assert.ok(legacy.every((c) => !c.profile.is_demo));
        assert.equal(
          await rpc(client, "count_creators", { p_include_demo: true }),
          summary.registered,
        );
        if (role !== "admin") {
          const campaigns = await client
            .from("campaigns")
            .select("id,is_demo")
            .eq("is_demo", true);
          assert.equal(campaigns.error, null);
          assert.deepEqual(
            campaigns.data,
            role === "brand" ? [{ id: legacyCampaign, is_demo: true }] : [],
          );
        }
      }
      const history = await roles.admin
        .from("campaigns")
        .select("id")
        .eq("id", legacyCampaign);
      assert.equal(history.error, null);
      assert.equal(history.data.length, 1);
    },
  );
  await check(
    "clients cannot enable the boundary, and billing OFF does not disable explicitly approved TEST data",
    async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_release.set_demo_catalog(boolean,text)','execute')`,
          ),
          "f",
        );
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_release.catalog_boundary','update')`,
          ),
          "f",
        );
      }
      sql(
        "select adme_release.set_test_billing(false,'local-d005-billing-off');select adme_release.set_demo_catalog(true,'local-d005-demo-only');",
      );
      assert.equal(
        (await rpc(roles.anon, "creator_public_one", { p_ref: "creator-001" }))
          .is_demo,
        true,
      );
      assert.equal(
        (await rpc(roles.anon, "creator_home_summary", { p_demo: true })).demo,
        48,
      );
      assert.ok(
        (
          await rpc(roles.anon, "search_creators", { p_include_demo: true })
        ).some((c) => c.profile.is_demo),
      );
      assert.equal(
        (await roles.brand.from("products").select("sku")).data.length,
        0,
      );
      assert.equal(
        await rpc(roles.brand, "toggle_saved_creator", {
          p_ref: "creator-001",
        }),
        true,
      );
      snapshot = await rpc(roles.brand, "recommendation_create_v12", {
        p_campaign: campaign,
        p_key: key,
        p_demo: true,
      });
      const page = await rpc(roles.brand, "recommendation_page_v12", {
        p_campaign: campaign,
        p_snapshot: snapshot,
        p_demo: true,
      });
      assert.ok(page.snapshot.results.some((r) => r.isDemo));
      assert.equal(
        await rpc(roles.brand, "recommendation_create_v12", {
          p_campaign: campaign,
          p_key: key,
          p_demo: true,
        }),
        snapshot,
      );
    },
  );
  await check(
    "OFF again hides saved DTOs and archived recommendation results without deleting favorites, snapshots or seed records",
    async () => {
      sql("select adme_release.set_demo_catalog(false,'local-d005-off-again')");
      for (let attempt = 0; attempt < 2; attempt++)
        assert.equal(
          await rpc(roles.anon, "creator_public_one", { p_ref: "creator-001" }),
          null,
        );
      const saved = await rpc(roles.brand, "my_saved_creator_catalog");
      assert.ok(
        saved.some((c) => c.creator_id === "creator-001" && c.creator === null),
      );
      const page = await rpc(roles.brand, "recommendation_page_v12", {
        p_campaign: campaign,
        p_snapshot: snapshot,
        p_demo: true,
      });
      assert.ok(page.snapshot.results.every((r) => !r.isDemo));
      assert.ok(page.snapshot.withheldCount > 0);
      assert.equal(
        sql(
          `select count(*) from adme_recommendation.snapshots where id='${snapshot}'`,
        ),
        "1",
      );
      assert.equal(
        sql(
          "select md5(string_agg(id||profile::text,','order by id)) from public.creators where profile->'is_demo'='true'::jsonb",
        ),
        before,
      );
      for (const client of [roles.anon, roles.creator])
        assert.ok(
          (
            await client.rpc("recommendation_page_v12", {
              p_campaign: campaign,
              p_snapshot: snapshot,
              p_demo: true,
            })
          ).error,
        );
      assert.equal(
        await rpc(roles.brand, "toggle_saved_creator", {
          p_ref: "creator-001",
        }),
        false,
      );
    },
  );
} finally {
  try {
    sql(
      `begin;alter table adme_recommendation.snapshots disable trigger user;delete from adme_recommendation.snapshots where campaign_id='${campaign}';alter table adme_recommendation.snapshots enable trigger user;delete from public.campaigns where id in('${campaign}','${legacyCampaign}');delete from public.creators where id='${creatorId}';commit;`,
    );
  } finally {
    for (const [table, row] of Object.entries(prior)) {
      const flag = table === "catalog_boundary" ? "demo_enabled" : "enabled";
      sql(
        `update adme_release.${table} set (${flag},release_ref,changed_at)=(select ${flag},release_ref,changed_at from json_populate_record(null::adme_release.${table},'${row.replaceAll("'", "''")}')) where singleton`,
      );
      assert.equal(
        sql(`select row_to_json(b) from adme_release.${table} b`),
        row,
      );
    }
  }
}
writeFileSync(
  "output/dev-a-db/d005-demo-boundary.local.json",
  JSON.stringify(
    { scope: "fictional local PostgreSQL/PostgREST; no provider", results },
    null,
    2,
  ),
);
