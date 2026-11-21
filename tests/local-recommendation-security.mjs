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
const ids = { brand: randomUUID(), creator: randomUUID(), other: randomUUID() },
  campaign = randomUUID(),
  second = randomUUID(),
  creatorId = `user-${ids.creator}`;
const clients = Object.fromEntries(
    Object.entries(ids).map(([k, v]) => [
      k,
      localClient(undefined, localJwt(v)),
    ]),
  ),
  anon = localClient(),
  results = [];
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const create = (client = clients.brand, key = randomUUID(), id = campaign) =>
  client.rpc("recommendation_create", { p_campaign: id, p_key: key });
const page = async (snapshot = null) => {
  const r = await clients.brand.rpc("recommendation_page", {
    p_campaign: campaign,
    p_snapshot: snapshot,
  });
  assert.equal(r.error, null);
  return r.data;
};
const seed = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0];
const profile = {
  ...seed,
  name: "가상 추천 기록 QA",
  vibes: ["snapshot-qa"],
  is_available: true,
  price_min_krw: 0,
  price_max_krw: 1000000,
  owner_consent: true,
  social_url: "https://www.youtube.com/@fictionalSnapshotQA",
  private_note: "PRIVATE_D045_CANARY",
};
let creatorRef;
let first,
  newer,
  key = randomUUID();
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','local-fixture-only','{}','{"role":"${role === "creator" ? "creator" : "brand"}","name":"Fictional snapshot QA"}',now(),now());`,
    );
  sql(`insert into public.creators(id,owner_id,published,profile) values('${creatorId}','${ids.creator}',true,'${literal(profile)}');
 insert into public.campaigns(id,owner_id,brief,status) select '${campaign}','${ids.brand}',brief||jsonb_build_object('vibes',jsonb_build_array('snapshot-qa'),'category','${seed.categories[0]}','format','${seed.formats[0]}','platforms',to_jsonb(array['${seed.platforms[0]}']),'budget_krw',10000),'published' from public.campaigns limit 1;
 insert into public.campaigns(id,owner_id,brief) select '${second}','${ids.brand}',brief from public.campaigns where id='${campaign}';`);
  creatorRef=sql(`select adme_creator.public_reference('${creatorId}');`);
  await check(
    "anonymous/foreign/creator requests, private table access and helper execution are denied",
    async () => {
      for (const c of [anon, clients.other, clients.creator]) {
        assert.ok((await create(c)).error);
        assert.ok(
          (await c.rpc("recommendation_page", { p_campaign: campaign })).error,
        );
      }
      assert.equal(
        sql(
          "select relrowsecurity from pg_class where oid='adme_recommendation.snapshots'::regclass;",
        ),
        "t",
      );
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_recommendation.snapshots','select');`,
          ),
          "f",
        );
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_recommendation.context(uuid)','execute');`,
          ),
          "f",
        );
      }
      assert.equal(
        (
          await clients.brand.rpc(
            "recommendation_page",
            { p_campaign: campaign },
            { get: true },
          )
        ).status,
        405,
      );
      assert.equal((await page()).snapshot, null);
    },
  );
  await check(
    "12 concurrent same-key saves create exactly one snapshot/quota reservation and reject cross-campaign key reuse",
    async () => {
      const writes = await Promise.all(
        Array.from({ length: 12 }, () => create(clients.brand, key)),
      );
      for (const r of writes) assert.equal(r.error, null);
      first = writes[0].data;
      assert.equal(new Set(writes.map((x) => x.data)).size, 1);
      assert.equal(
        sql(
          `select count(*) from adme_recommendation.snapshots where campaign_id='${campaign}';`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select used from adme_ops.rate_windows where scope='recommendation_create' and subject='${ids.brand}';`,
        ),
        "1",
      );
      assert.equal(
        (await create(clients.brand, key, second)).error?.code,
        "23505",
      );
    },
  );
  await check(
    "stored DB-owned input/version/reasons are bounded, provenance-labeled and omit private or HOT fields",
    async () => {
      const p = await page();
      assert.equal(p.snapshot.id, first);
      assert.equal(p.snapshot.stale, false);
      assert.equal(p.snapshot.modelVersion, "adme-1.0");
      const r = p.snapshot.results.find((x) => x.creatorId === creatorRef);
      assert.ok(r);
      assert.equal(r.score, 100);
      assert.equal(r.coverage, 80);
      assert.deepEqual(r.missing, ["타깃 고객"]);
      assert.deepEqual(r.matchedTags, ["snapshot-qa"]);
      assert.equal(r.isDemo, true);
      // D075 now keeps Auth identifiers out of persisted public projections too.
      for (const value of [
        "PRIVATE_D045_CANARY",
        "owner_id",
        "request_key",
        ids.brand,
        ids.creator,
        '"hot"',
      ])
        assert.ok(!JSON.stringify(p).includes(value));
      assert.equal(Object.hasOwn(r, "ownerId"), false);
    },
  );
  await check(
    "HOT/raw irrelevant field changes cannot affect source versions, scores or ordering",
    async () => {
      const before = (await page()).snapshot;
      sql(
        `update public.creators set profile=profile||'{"hot":true,"paid_rank":999}'::jsonb where id='${creatorId}';`,
      );
      const after = (await page()).snapshot;
      assert.equal(after.stale, false);
      assert.deepEqual(after.results, before.results);
      const r = await create();
      assert.equal(r.error, null);
      const recalculated = (await page(r.data)).snapshot;
      assert.equal(recalculated.sourceVersion, before.sourceVersion);
      assert.deepEqual(recalculated.results, before.results);
    },
  );
  await check(
    "source changes mark old records stale; explicit recalculation creates a new immutable version without overwriting old scores",
    async () => {
      sql(
        `update public.creators set profile=jsonb_set(profile,'{price_min_krw}','1000000') where id='${creatorId}';`,
      );
      const old = (await page(first)).snapshot;
      assert.equal(old.stale, true);
      assert.equal(
        old.results.find((x) => x.creatorId === creatorRef).score,
        100,
      );
      const r = await create();
      assert.equal(r.error, null);
      newer = r.data;
      assert.notEqual(newer, first);
      const current = (await page()).snapshot;
      assert.equal(current.id, newer);
      assert.equal(current.stale, false);
      assert.ok(
        current.results.find((x) => x.creatorId === creatorRef).score < 100,
      );
      assert.equal(
        (await page(first)).snapshot.results.find(
          (x) => x.creatorId === creatorRef,
        ).score,
        100,
      );
      assert.equal((await create(clients.brand, key)).data, first);
      sql(
        `update public.campaigns set brief=jsonb_set(brief,'{budget_krw}','20000') where id='${campaign}';`,
      );
      assert.equal((await page(newer)).snapshot.stale, true);
    },
  );
  await check(
    "withdrawn profiles and revoked source-link consent remain hidden even in archived snapshots",
    async () => {
      sql(
        `update public.creators set published=false where id='${creatorId}';`,
      );
      const p = await page(first);
      assert.equal(p.snapshot.withheldCount, 1);
      assert.ok(!JSON.stringify(p).includes(creatorId));
      assert.ok(!JSON.stringify(p).includes(profile.name));
      sql(
        `update public.creators set published=true,profile=jsonb_set(profile,'{owner_consent}','false') where id='${creatorId}';`,
      );
      const r = (await page(first)).snapshot.results.find(
        (x) => x.creatorId === creatorRef,
      );
      assert.equal(r.sourceUrl, null);
    },
  );
  await check(
    "snapshot UPDATE/DELETE are denied and current DB role/moderation override stale JWT permissions",
    async () => {
      for (const statement of [
        `update adme_recommendation.snapshots set results='[]' where id='${first}';`,
        `delete from adme_recommendation.snapshots where id='${first}';`,
      ])
        assert.throws(() => sql(statement), /immutable/);
      sql(`update public.profiles set role='creator' where id='${ids.brand}';`);
      assert.equal((await create()).error?.code, "42501");
      assert.equal(
        (
          await clients.brand.rpc("recommendation_page", {
            p_campaign: campaign,
          })
        ).error?.code,
        "42501",
      );
      sql(
        `update public.profiles set role='brand' where id='${ids.brand}';update public.campaigns set moderation_status='restricted' where id='${campaign}';`,
      );
      assert.equal((await create()).error?.code, "42501");
      sql(
        `update public.campaigns set moderation_status='allowed' where id='${campaign}';`,
      );
    },
  );
  await check(
    "atomic account quota admits only10 unique requests and a saved retry remains available at the limit",
    async () => {
      sql(
        `delete from adme_ops.rate_windows where scope='recommendation_create' and subject='${ids.brand}';`,
      );
      const writes = await Promise.all(
        Array.from({ length: 13 }, () => create()),
      );
      assert.equal(writes.filter((x) => !x.error).length, 10);
      assert.equal(writes.filter((x) => x.error?.code === "PT429").length, 3);
      assert.equal((await create(clients.brand, key)).data, first);
      assert.equal(
        sql(
          `select used from adme_ops.rate_windows where scope='recommendation_create' and subject='${ids.brand}';`,
        ),
        "10",
      );
    },
  );
  await check(
    "catalog cap fails closed above1000 rather than silently ranking a truncated sample",
    async () => {
      const n = sql("select count(*) from public.creators;");
      assert.throws(
        () =>
          sql(
            `begin;insert into public.creators(id,published,profile) select 'd045-cap-'||n,true,'${literal(profile)}'::jsonb from generate_series(1,1001) n;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${ids.brand}","role":"authenticated"}',true);select public.recommendation_page('${campaign}');rollback;`,
          ),
        /snapshot cap/,
      );
      assert.equal(sql("select count(*) from public.creators;"), n);
    },
  );
  await check(
    "shared read budget rejects excessive requests before the catalogue scan",
    async () => {
      sql(
        `delete from adme_ops.rate_windows where scope='recommendation_context' and subject='${ids.brand}';select adme_ops.take_quota('recommendation_context','${ids.brand}',120,60,120);`,
      );
      const denied = await clients.brand.rpc("recommendation_page", {
        p_campaign: campaign,
      });
      assert.equal(denied.error?.code, "PT429");
      assert.throws(
        () =>
          sql(
            `begin;insert into public.creators(id,published,profile) select 'd045-budget-'||n,true,'${literal(profile)}'::jsonb from generate_series(1,1001) n;set local role authenticated;select set_config('request.jwt.claims','{"sub":"${ids.brand}","role":"authenticated"}',true);select public.recommendation_page('${campaign}');rollback;`,
          ),
        /request limit reached/,
      );
      sql(
        `delete from adme_ops.rate_windows where scope='recommendation_context' and subject='${ids.brand}';`,
      );
    },
  );
  await check(
    "foreign campaign deletion is denied and actual owner deletion cascades only its recommendation history",
    async () => {
      const foreign = await clients.other
        .from("campaigns")
        .delete()
        .eq("id", campaign)
        .select("id");
      assert.equal(foreign.error, null);
      assert.equal(foreign.data.length, 0);
      assert.equal((await page(first)).snapshot.id, first);
      const own = await clients.brand
        .from("campaigns")
        .delete()
        .eq("id", campaign)
        .select("id");
      assert.equal(own.error, null);
      assert.equal(own.data.length, 1);
      assert.equal(
        sql(
          `select count(*) from adme_recommendation.snapshots where campaign_id='${campaign}';`,
        ),
        "0",
      );
    },
  );
} finally {
  sql(
    `begin;alter table adme_recommendation.snapshots disable trigger user;delete from adme_recommendation.snapshots where owner_id='${ids.brand}';alter table adme_recommendation.snapshots enable trigger user;delete from public.campaigns where id in('${campaign}','${second}');delete from public.creators where id='${creatorId}';delete from adme_ops.rate_windows where subject in('${ids.brand}','${ids.creator}','${ids.other}');delete from auth.users where id in('${ids.brand}','${ids.creator}','${ids.other}');commit;`,
  );
}
writeFileSync(
  "output/dev-a-db/recommendation-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "actual isolated local SQL/PostgREST; fictional data only, no provider or hosted writes",
      results,
    },
    null,
    2,
  ),
);
