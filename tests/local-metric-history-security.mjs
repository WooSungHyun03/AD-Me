import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { localRuntime, localClient, sql } from "./support/local-qa.mjs";
localRuntime();
const ids = [randomUUID(), randomUUID(), randomUUID()],
  creators = ids.map((id) => "user-" + id),
  identities = [randomUUID(), randomUUID()],
  policy = "fictional-" + randomUUID(),
  anon = localClient(),
  results = [],
  base = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0];
const lit = (v) => JSON.stringify(v).replaceAll("'", "''"),
  check = async (name, fn) => {
    await fn();
    results.push({ name, result: "PASS" });
    console.log("PASS " + name);
  };
const history = async (n = 0) => {
  const r = await anon.rpc("creator_metric_history", {
    p_ref: creators[n],
    p_days: 30,
  });
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
const filters = {
  query: "가상 지표 필터 " + policy,
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
const page = async (extra = {}) => {
  const r = await anon.rpc("creator_filter_page", {
    p_filters: { ...filters, ...extra },
    p_demo: false,
  });
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
try {
  for (let n = 0; n < ids.length; n++)
    sql(
      `insert into auth.users(id,raw_user_meta_data)values('${ids[n]}','{"role":"creator","name":"가상 metric QA"}');insert into public.creators(id,owner_id,published,profile)values('${creators[n]}','${ids[n]}',true,'${lit({ ...base, name: "가상 지표 필터 " + policy, bio: "FICTIONAL metric QA " + n, is_demo: false, owner_consent: true, followers: 0, metrics_source: "unavailable" })}');`,
    );
  for (let n = 0; n < 2; n++) {
    const provider = n ? "youtube" : "approved_web";
    sql(
      `insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version,claim_status,owner_consent,publication_status)select '${identities[n]}',id,'${provider}','private-external-${identities[n]}','가상 관측','https://example.test/fictional-metric',now(),'${n ? "official_api" : "approved_web"}','${policy}','claimed',true,'published'from adme_creator.records where legacy_creator_id='${creators[n]}';insert into adme_creator.publication_policies(provider,policy_version,permission_ref,ttl_seconds,metric_units,derived_allowed)values('${provider}','${policy}','FICTIONAL_LOCAL_ONLY',3600,'{"views":"count","engagement_rate":"percent"}',true);`,
    );
    sql(
      `insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind,formula_text,sample_size,period_start,period_end)values('${identities[n]}','engagement_rate',0,'percent',now(),'https://example.test/fictional-metric','${policy}','derived','가상: interactions / observed views * 100',3,now()-interval'1 hour',now());`,
    );
  }
  for (const [value, offset] of [
    ["0", "3 hours"],
    ["null", "2 hours"],
    ["10", "30 minutes"],
  ])
    sql(
      `insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind)values('${identities[0]}','views',${value},'count',now()-interval'${offset}','https://example.test/fictional-metric','${policy}','original');`,
    );
  await check(
    "unapproved policies hide series and engagement capability; legacy filters remain compatible",
    async () => {
      assert.equal((await history()).identities.length, 0);
      assert.equal((await page()).total, 3);
      assert.equal((await page({ minEngagement: "0" })).total, 0);
      assert.equal((await page()).metrics.engagement.available, false);
      sql(
        `update adme_creator.publication_policies set enabled=true where policy_version='${policy}';`,
      );
      assert.equal((await history()).identities.length,0); // Current publication approval is insufficient for history.
      sql(`update adme_creator.publication_policies set history_allowed=true,history_permission_ref='FICTIONAL LOCAL HISTORY ONLY',history_window_seconds=14400 where policy_version='${policy}';`);
    },
  );
  await check(
    "original zero/null/history/source retained; YouTube derived denied on both current and series surfaces",
    async () => {
      const h = await history(),
        points = h.identities[0].points;
      assert.deepEqual(
        points.filter((p) => p.name === "views").map((p) => p.value),
        [0, null, 10],
      );
      assert.equal(h.identities[0].isDemo, false);
      assert.equal(h.identities[0].pointsTruncated, false);
      sql(`update adme_creator.publication_policies set history_window_seconds=3600 where policy_version='${policy}';`);
      assert.deepEqual((await history()).identities[0].points.filter(p=>p.name==='views').map(p=>p.value),[10]);
      sql(`update adme_creator.publication_policies set history_window_seconds=14400 where policy_version='${policy}';`);
      for (const secret of [
        ...ids,
        "private-external",
        "owner_id",
        "ownerConsent",
      ])
        assert.ok(!JSON.stringify(h).includes(secret));
      assert.equal((await history(1)).identities[0].points.length, 0);
      const r = await anon.rpc("creator_normalized_public", {
        p_ref: creators[1],
      });
      assert.equal(r.error, null);
      assert.equal(r.data.identities[0].metrics.length, 0);
    },
  );
  await check(
    "explicit 0% includes genuine measured zero only; missing and YouTube values never pass",
    async () => {
      const future = randomUUID();
      sql(
        `insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version,claim_status,owner_consent,publication_status)select '${future}',id,'approved_web','private-future-${future}','가상 미래 자료','https://example.test/fictional-future',now()+interval'1 hour','approved_web','${policy}','claimed',true,'published'from adme_creator.records where legacy_creator_id='${creators[0]}';insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind,formula_text,sample_size,period_start,period_end)values('${future}','engagement_rate',99,'percent',now(),'https://example.test/fictional-future','${policy}','derived','FUTURE_FORMULA_CANARY',3,now()-interval'1 hour',now());`,
      );
      const p = await page({ minEngagement: "0" });
      assert.equal(p.total, 1);
      assert.equal(
        p.items[0].seed_id,
        sql(`select adme_creator.public_reference('${creators[0]}');`),
      );
      assert.equal((await page({ minEngagement: "1" })).total, 0);
      assert.equal(p.metrics.engagement.available, true);
      assert.ok(!JSON.stringify(p).includes("FUTURE_FORMULA_CANARY"));
      assert.ok(
        p.metrics.engagement.definitions.some((d) =>
          d.formula.includes("interactions"),
        ),
      );
      for (const extra of [
        { minEngagement: "101" },
        { minEngagement: "-1" },
        { age: "20" },
        { gender: "female" },
      ])
        assert.ok(
          (
            await anon.rpc("creator_filter_page", {
              p_filters: { ...filters, ...extra },
              p_demo: false,
            })
          ).error,
        );
    },
  );
  await check(
    "latest null, stale, small sample, policy withdrawal and moderation fail closed",
    async () => {
      sql(
        `update adme_creator.metric_observations set value=null where identity_id='${identities[0]}'and name='engagement_rate';`,
      );
      assert.equal((await page({ minEngagement: "0" })).total, 0);
      sql(
        `update adme_creator.metric_observations set value=0,sample_size=3,period_end=now()+interval'1 hour'where identity_id='${identities[0]}'and name='engagement_rate';`,
      );
      assert.equal((await page({ minEngagement: "0" })).total, 0);
      assert.ok(
        (await history()).identities[0].points.every(
          (p) => p.name !== "engagement_rate",
        ),
      );
      const current = await anon.rpc("creator_normalized_public", {
        p_ref: creators[0],
      });
      assert.equal(current.error, null);
      assert.ok(
        current.data.identities[0].metrics.every(
          (p) => p.name !== "engagement_rate",
        ),
      );
      sql(
        `update adme_creator.metric_observations set value=0,sample_size=1,period_end=now() where identity_id='${identities[0]}'and name='engagement_rate';`,
      );
      assert.equal((await page({ minEngagement: "0" })).total, 0);
      sql(
        `update adme_creator.metric_observations set sample_size=3,observed_at=now()-interval'2 hours',period_end=now()-interval'2 hours',period_start=now()-interval'3 hours'where identity_id='${identities[0]}'and name='engagement_rate';`,
      );
      assert.equal((await page({ minEngagement: "0" })).total, 0);
      sql(
        `update public.creators set moderation_status='restricted'where id='${creators[0]}';`,
      );
      assert.equal(await history(), null);
      sql(
        `update public.creators set moderation_status='allowed'where id='${creators[0]}';update adme_creator.publication_policies set enabled=false where policy_version='${policy}';`,
      );
      assert.equal((await history()).identities.length, 0);
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_creator.engagement_value(text)','execute');`,
          ),
          "f",
        );
    },
  );
} finally {
  sql(
    `delete from public.creators where id in('${creators.join("','")}');delete from adme_creator.publication_policies where policy_version='${policy}';delete from auth.users where id in('${ids.join("','")}');`,
  );
}
writeFileSync(
  "harness/evidence/DEV-A-READY-20261122/metric-security.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "Actual local PostgreSQL/PostgREST with fictional observations/policy; no actual platform metric verification",
      results,
    },
    null,
    2,
  ) + "\n",
);
