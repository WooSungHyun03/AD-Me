// Actual isolated Postgres/PostgREST contracts. All channels below are fictional.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";
import { enableLocalIngestionPolicy } from "./support/ingestion-fixture.mjs";
localRuntime();
const prefix = "D033 SYNTHETIC ";
const ids = Array.from(
  { length: 67 },
  (_, i) => "UCd033" + String(i).padStart(18, "0"),
);
const anon = localClient();
const account = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
).brand.id;
const brand = localClient(undefined, localJwt(account));
const filters = {
  query: prefix,
  topic: "",
  subscribers: "",
  sort: "subscribers",
};
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
}
async function page(f = filters, cursor = null, limit = 24, client = anon) {
  const response = await client.rpc("youtube_directory_page", {
    p_filters: f,
    p_cursor: cursor,
    p_limit: limit,
  });
  assert.equal(
    response.error,
    null,
    `${response.error?.message}; sort=${f.sort}, cursor=${cursor ? Buffer.from(cursor, "base64").toString("utf8") : "first"}`,
  );
  return response.data;
}
const list = ids.map((id) => `'${id}'`).join(",");
const policyBefore = sql(
  "select coalesce((select enabled::text from adme_ops.source_runtime_policies where version='local-source-policy-1'),'absent')",
);
try {
  enableLocalIngestionPolicy();
  sql(`insert into adme_ops.channels(channel_id,title,subscriber_count,metadata)
    select 'UCd033'||lpad(i::text,18,'0'),'D033 SYNTHETIC '||lpad((i%10)::text,2,'0'),case when i%3=0 then null when i%3=1 then 0 else 1500000 end,
    jsonb_build_object('topics',jsonb_build_array(case when i%2=0 then 'https://en.wikipedia.org/wiki/Technology' else 'https://en.wikipedia.org/wiki/Food' end),'contact','PRIVATE-D033','avatar',null)
    from generate_series(0,66)i;
    insert into adme_ops.featured_channel_ids(channel_id)select channel_id from adme_ops.channels where channel_id in(${list});
    update adme_ops.channels set review='rejected' where channel_id='${ids[63]}';
    update adme_ops.channels set expires_at=now()-interval '1 second' where channel_id='${ids[64]}';
    delete from adme_ops.featured_channel_ids where channel_id='${ids[65]}';
    insert into adme_ops.source_tombstones(resource_hash,policy_version,request_ref,expires_at)values(adme_ops.resource_hash('${ids[66]}'),'local-source-policy-1',gen_random_uuid(),now()+interval '1 day');
    delete from adme_ops.rate_windows where scope='youtube_directory';`);
  await check(
    "all three tie-safe sort orders paginate 63 eligible fictional channels without duplicates or omissions",
    async () => {
      for (const sort of ["subscribers", "updated", "name"]) {
        const all = [];
        let cursor = null;
        do {
          const p = await page({ ...filters, sort }, cursor);
          assert.equal(p.total, 63);
          assert.ok(p.items.length <= 24);
          all.push(...p.items);
          cursor = p.nextCursor;
        } while (cursor);
        assert.equal(new Set(all.map((item) => item.channel_id)).size, 63);
        assert.deepEqual(
          new Set(all.map((item) => item.channel_id)),
          new Set(ids.slice(0, 63)),
        );
        for (const item of all)
          assert.deepEqual(
            Object.keys(item).sort(),
            [
              "channel_id",
              "title",
              "subscriber_count",
              "fetched_at",
              "creator_id",
              "videos",
              "metadata",
            ].sort(),
          );
        assert.ok(!JSON.stringify(all).includes("PRIVATE-D033"));
        if (sort === "subscribers") {
          assert.equal(all[0].subscriber_count, 1500000);
          assert.equal(all.at(-1).subscriber_count, null);
        }
      }
    },
  );
  await check(
    "topic/range/query filters precede pagination; null differs from zero and query wildcards are literal",
    async () => {
      assert.equal(
        (await page({ ...filters, subscribers: "under-100k" })).total,
        21,
      );
      assert.equal(
        (await page({ ...filters, subscribers: "over-1m" })).total,
        21,
      );
      assert.equal((await page({ ...filters, topic: "테크·게임" })).total, 32);
      assert.equal((await page({ ...filters, query: prefix + "%" })).total, 0);
      assert.equal((await page({ ...filters, query: prefix + "_" })).total, 0);
      assert.equal((await page({ ...filters, query: prefix + "09" })).total, 6);
    },
  );
  await check(
    "anonymous and authenticated share only the safe projection; private tables stay denied",
    async () => {
      assert.deepEqual(
        (await page(filters, null, 50, brand)).items,
        (await page(filters, null, 50)).items,
      );
      for (const role of ["anon", "authenticated"])
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_ops.channels','select');`,
          ),
          "f",
        );
    },
  );
  await check(
    "malformed, cross-filter cursors, unknown inputs and out-of-range limits are rejected",
    async () => {
      const cursor = (await page()).nextCursor;
      for (const args of [
        {
          p_filters: { ...filters, query: "different" },
          p_cursor: cursor,
          p_limit: 24,
        },
        { p_filters: filters, p_cursor: "not-base64", p_limit: 24 },
        {
          p_filters: { ...filters, owner: "private" },
          p_cursor: null,
          p_limit: 24,
        },
        ...[0, 51, null].map((p_limit) => ({
          p_filters: filters,
          p_cursor: null,
          p_limit,
        })),
      ])
        assert.equal(
          (await anon.rpc("youtube_directory_page", args)).error?.code,
          "22023",
        );
    },
  );
  await check(
    "policy withdrawal hides records immediately and indexes exist",
    async () => {
      sql(
        "update adme_ops.source_runtime_policies set enabled=false where version='local-source-policy-1';",
      );
      assert.equal((await page()).total, 0);
      sql(
        "update adme_ops.source_runtime_policies set enabled=true where version='local-source-policy-1';",
      );
      assert.equal(
        sql(
          "select count(*) from pg_indexes where schemaname='adme_ops' and indexname in('youtube_directory_subscribers106','youtube_directory_updated106')",
        ),
        "2",
      );
    },
  );
} finally {
  sql(`delete from adme_ops.source_tombstones where resource_hash in(select adme_ops.resource_hash(unnest(array[${list}])));
    delete from adme_ops.featured_channel_ids where channel_id in(${list});delete from adme_ops.channels where channel_id in(${list});
    delete from adme_ops.rate_windows where scope='youtube_directory';
    update adme_ops.source_runtime_policies set enabled=${policyBefore === "true" || policyBefore === "t"} where version='local-source-policy-1';`);
}
writeFileSync(
  "output/dev-a-db/youtube-directory.local.json",
  JSON.stringify(
    {
      scope: "isolated fictional database, no provider or hosted acceptance",
      results,
    },
    null,
    2,
  ),
);
