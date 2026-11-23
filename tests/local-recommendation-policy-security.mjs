// Fictional local SQL/PostgREST only. No platform or model provider calls.
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
const ids = { brand: randomUUID(), other: randomUUID(), creator: randomUUID() };
const campaign = randomUUID(),
  second = randomUUID(),
  key = randomUUID();
const clients = Object.fromEntries(
  Object.entries(ids).map(([k, v]) => [k, localClient(undefined, localJwt(v))]),
);
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const results = [];
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const create = (
  requestKey = randomUUID(),
  demo = true,
  actor = clients.brand,
  id = campaign,
) =>
  actor.rpc("recommendation_create_v12", {
    p_campaign: id,
    p_key: requestKey,
    p_demo: demo,
  });
const get = async (snapshot = null, demo = true) => {
  const r = await clients.brand.rpc("recommendation_page_v12", {
    p_campaign: campaign,
    p_snapshot: snapshot,
    p_demo: demo,
  });
  assert.equal(r.error, null);
  return r.data;
};
const seed = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0];
const creatorIds = [0, 1, 2].map((n) => `policy-${ids.creator}-${n}`);
let refs, legacy, first;
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','local-fixture-only','{}','{"role":"${role === "creator" ? "creator" : "brand"}","name":"Fictional policy QA"}',now(),now());`,
    );
  for (const [n, id] of creatorIds.entries()) {
    const profile = {
      ...seed,
      name: `가상 정책 QA ${n}`,
      categories: n === 1 ? [] : ["policy-only"],
      vibes: ["policy-qa"],
      formats: ["숏폼"],
      platforms: ["youtube"],
      is_available: true,
      price_min_krw: n === 2 ? 20000 : 0,
      price_max_krw: 20000,
      owner_consent: true,
      private_note: "PRIVATE_POLICY_CANARY",
    };
    sql(
      `insert into public.creators(id,owner_id,published,profile)values('${id}',${n === 0 ? `'${ids.creator}'` : "null"},true,'${literal(profile)}');`,
    );
  }
  refs = creatorIds.map((id) =>
    sql(`select adme_creator.public_reference('${id}')`),
  );
  sql(`insert into public.campaigns(id,owner_id,brief,status,is_demo)select '${campaign}','${ids.brand}',brief||'{"category":"policy-only","vibes":["policy-qa"],"format":"숏폼","platforms":["youtube"],"budget_krw":10000}'::jsonb,'published',true from public.campaigns limit 1;
 insert into public.campaigns(id,owner_id,brief)select '${second}','${ids.brand}',brief from public.campaigns where id='${campaign}';`);
  await check(
    "legacy1.0 replay/history survives while modern policy changes mark it stale",
    async () => {
      const r = await clients.brand.rpc("recommendation_create", {
        p_campaign: campaign,
        p_key: key,
      });
      assert.equal(r.error, null);
      legacy = r.data;
      const frozen = sql(
        `select md5(results::text) from adme_recommendation.snapshots where id='${legacy}'`,
      );
      sql(
        `update public.campaigns set brief=brief||'{"policy":{"category":"hard","budget":"hard","unknown":"hold"}}'::jsonb where id='${campaign}'`,
      );
      assert.equal(
        (
          await clients.brand.rpc("recommendation_page", {
            p_campaign: campaign,
          })
        ).data.snapshot.stale,
        true,
      );
      assert.equal((await create(key)).data, legacy);
      assert.equal(
        sql(
          `select md5(results::text)from adme_recommendation.snapshots where id='${legacy}'`,
        ),
        frozen,
      );
      assert.equal(
        (
          await clients.brand.rpc("recommendation_create", {
            p_campaign: campaign,
            p_key: randomUUID(),
          })
        ).error?.code,
        "22023",
      );
    },
  );
  await check(
    "12 same-key saves reserve once; hard mismatches excluded, unknown held, confirmed first",
    async () => {
      const k = randomUUID(),
        writes = await Promise.all(Array.from({ length: 12 }, () => create(k)));
      for (const r of writes) assert.equal(r.error, null);
      first = writes[0].data;
      assert.equal(new Set(writes.map((r) => r.data)).size, 1);
      assert.equal(
        (await create(k, true, clients.brand, second)).error?.code,
        "23505",
      );
      const s = (await get(first)).snapshot;
      assert.equal(s.modelVersion, "adme-1.2");
      assert.equal(s.stale, false);
      assert.equal(s.eligibleCount, 1);
      assert.equal(s.heldCount, 1);
      assert.deepEqual(
        s.results.map((r) => r.creatorId),
        refs.slice(0, 2),
      );
      assert.equal(s.results[0].eligible, true);
      assert.equal(s.results[1].eligible, false);
      assert.equal(s.results[1].status, "hold");
      assert.deepEqual(s.results[1].reasons, ["분야 미확인"]);
      assert.equal(s.results[1].coverage, 55);
      assert.equal(s.results[1].breakdown[1].value, null);
      for (const value of [
        ids.brand,
        ids.creator,
        "PRIVATE_POLICY_CANARY",
        '"hot"',
        '"owner_id"',
      ])
        assert.ok(!JSON.stringify(s).includes(value));
      const old = await clients.brand.rpc("recommendation_page", {
        p_campaign: campaign,
      });
      assert.equal(old.error, null);
      assert.equal(old.data.snapshot.id, legacy);
      assert.equal(old.data.history.length, 1);
      assert.equal(
        (
          await clients.brand.rpc("recommendation_page", {
            p_campaign: campaign,
            p_snapshot: first,
          })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "unknown-exclude changes source fingerprint without rewriting prior scores; old read honors current visibility",
    async () => {
      sql(
        `update public.campaigns set brief=jsonb_set(brief,'{policy,unknown}','"exclude"')where id='${campaign}'`,
      );
      assert.equal((await get(first)).snapshot.stale, true);
      const r = await create();
      assert.equal(r.error, null);
      const s = (await get(r.data)).snapshot;
      assert.equal(s.heldCount, 0);
      assert.equal(s.results.length, 1);
      assert.equal((await get(first)).snapshot.results[1].status, "hold");
      sql(
        `update public.creators set published=false where id='${creatorIds[1]}'`,
      );
      assert.equal((await get(first)).snapshot.withheldCount, 1);
      sql(
        `update public.creators set published=true where id='${creatorIds[1]}'`,
      );
    },
  );
  await check(
    "default/free scope excludes fictional candidates on create and archived read",
    async () => {
      const hidden = (await get(first, false)).snapshot;
      assert.equal(hidden.results.length, 0);
      assert.equal(hidden.withheldCount, 2);
      assert.equal(hidden.stale, true);
      const r = await create(randomUUID(), false);
      assert.equal(r.error, null);
      const s = (await get(r.data, false)).snapshot;
      assert.equal(s.input.includeDemo, false);
      assert.equal(
        s.results.some((r) => r.isDemo),
        false,
      );
      const bare = await clients.brand.rpc("recommendation_create_v12", {
        p_campaign: campaign,
        p_key: randomUUID(),
      });
      assert.equal(bare.error, null);
      assert.equal(
        (await get(bare.data, false)).snapshot.input.includeDemo,
        false,
      );
    },
  );
  await check(
    "anonymous/opposite/foreign, raw-table/helper access, current role and quarantine are denied",
    async () => {
      for (const client of [localClient(), clients.other, clients.creator]) {
        assert.ok((await create(randomUUID(), true, client)).error);
        assert.ok(
          (
            await client.rpc("recommendation_page_v12", {
              p_campaign: campaign,
            })
          ).error,
        );
      }
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_recommendation.snapshots','select')`,
          ),
          "f",
        );
        for (const f of [
          "context_v12(uuid,boolean)",
          "score_v12(jsonb,jsonb)",
          "normalize_policy(jsonb)",
        ])
          assert.equal(
            sql(
              `select has_function_privilege('${role}','adme_recommendation.${f}','execute')`,
            ),
            "f",
          );
      }
      sql(`update public.profiles set role='creator'where id='${ids.brand}'`);
      assert.equal((await create()).error?.code, "42501");
      sql(
        `update public.profiles set role='brand'where id='${ids.brand}';insert into adme_privacy.requests(id,actor_id,receipt_hash,reauth_at)values('${randomUUID()}','${ids.brand}',decode(repeat('00',32),'hex'),now());`,
      );
      assert.equal((await create()).error?.code, "42501");
      assert.equal(
        (
          await clients.brand.rpc("recommendation_page_v12", {
            p_campaign: campaign,
          })
        ).error?.code,
        "42501",
      );
      sql(`delete from adme_privacy.requests where actor_id='${ids.brand}'`);
    },
  );
  await check(
    "shared write/read quotas, immutable snapshots and actual owner-only cascade remain enforced",
    async () => {
      sql(`delete from adme_ops.rate_windows where subject='${ids.brand}'`);
      const writes = await Promise.all(
        Array.from({ length: 13 }, () => create()),
      );
      assert.equal(writes.filter((r) => !r.error).length, 10);
      assert.equal(writes.filter((r) => r.error?.code === "PT429").length, 3);
      assert.equal((await create(key)).data, legacy);
      assert.throws(
        () =>
          sql(
            `update adme_recommendation.snapshots set held_count=0 where id='${first}'`,
          ),
        /immutable/,
      );
      sql(
        `delete from adme_ops.rate_windows where scope='recommendation_context' and subject='${ids.brand}';select adme_ops.take_quota('recommendation_context','${ids.brand}',120,60,120)`,
      );
      assert.equal(
        (
          await clients.brand.rpc("recommendation_page_v12", {
            p_campaign: campaign,
          })
        ).error?.code,
        "PT429",
      );
      sql(`delete from adme_ops.rate_windows where subject='${ids.brand}'`);
      const foreign = await clients.other
        .from("campaigns")
        .delete()
        .eq("id", campaign)
        .select("id");
      assert.equal(foreign.error, null);
      assert.equal(foreign.data.length, 0);
      const own = await clients.brand
        .from("campaigns")
        .delete()
        .eq("id", campaign)
        .select("id");
      assert.equal(own.error, null);
      assert.equal(own.data.length, 1);
      assert.equal(
        sql(
          `select count(*) from adme_recommendation.snapshots where campaign_id='${campaign}'`,
        ),
        "0",
      );
    },
  );
} finally {
  sql(
    `begin;delete from adme_privacy.requests where actor_id='${ids.brand}';delete from public.campaigns where id in('${campaign}','${second}');delete from public.creators where id in(${creatorIds.map((id) => `'${id}'`).join(",")});delete from adme_ops.rate_windows where subject in(${Object.values(
      ids,
    )
      .map((id) => `'${id}'`)
      .join(",")});delete from auth.users where id in(${Object.values(ids)
      .map((id) => `'${id}'`)
      .join(",")});commit;`,
  );
}
writeFileSync(
  "output/d045-policy-security.local.json",
  JSON.stringify(
    {
      scope:
        "actual isolated SQL/PostgREST; fictional local data, no provider verification",
      results,
    },
    null,
    2,
  ),
);
