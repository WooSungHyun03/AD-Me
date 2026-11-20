// Isolated DB/REST tests only: all identities and observations below are fictional.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const ownerId = randomUUID(),
  nextOwnerId = randomUUID(),
  identityId = randomUUID();
const legacyId = `user-${ownerId}`,
  externalId = `fictional-local-${identityId}`;
const owner = localClient(undefined, localJwt(ownerId));
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
function rejected(statement, state = "23514") {
  sql(
    `do $check$ begin begin ${statement}; raise exception 'Expected rejection was absent'; exception when sqlstate '${state}' then null; end; end $check$;`,
  );
}
async function snapshot(client = owner) {
  const result = await client.rpc("my_creator_identity_snapshot");
  assert.equal(result.error, null);
  return result.data;
}
const legacyHash = () =>
  sql(
    "select md5(string_agg(id||profile::text,',' order by id)) from public.creators where id like 'creator-%';",
  );
const originalHash = legacyHash();
try {
  sql(`insert into auth.users(id,raw_user_meta_data) values('${ownerId}','{"role":"creator","name":"가상 정규화 QA"}'),('${nextOwnerId}','{"role":"creator","name":"가상 소유자 변경 QA"}');
    insert into public.creators(id,owner_id,published,profile) select '${legacyId}','${ownerId}',true,profile||'{"name":"가상 정규화 QA"}'::jsonb from public.creators where id='creator-001';`);
  const recordId = sql(
    `select id from adme_creator.records where legacy_creator_id='${legacyId}';`,
  );
  await check(
    "legacy UUID backfill and insert trigger create mappings without fabricated SNS IDs or metrics",
    async () => {
      assert.match(recordId, /^[a-f0-9-]{36}$/);
      assert.equal(
        sql(
          "select count(*) from public.creators c left join adme_creator.records r on r.legacy_creator_id=c.id where r.id is null;",
        ),
        "0",
      );
      assert.equal(sql("select count(*) from adme_creator.identities;"), "0");
      assert.equal(
        sql("select count(*) from adme_creator.metric_observations;"),
        "0",
      );
      assert.deepEqual((await snapshot()).identities, []);
    },
  );
  await check(
    "private tables deny direct REST and SQL table access for anon, authenticated and service_role",
    async () => {
      for (const table of ["records", "identities", "metric_observations"]) {
        for (const role of ["anon", "authenticated", "service_role"]) {
          assert.equal(
            sql(
              `select has_table_privilege('${role}','adme_creator.${table}','select') or has_table_privilege('${role}','adme_creator.${table}','insert') or has_table_privilege('${role}','adme_creator.${table}','update') or has_table_privilege('${role}','adme_creator.${table}','delete');`,
            ),
            "f",
          );
          rejected(
            `set local role ${role}; select * from adme_creator.${table}`,
            "42501",
          );
        }
        assert.ok((await owner.from(table).select("*")).error);
        assert.ok(
          (await owner.schema("adme_creator").from(table).select("*")).error,
        );
      }
      assert.ok(
        (await localClient().rpc("my_creator_identity_snapshot")).error,
      );
      assert.equal(
        sql(
          "select has_function_privilege('anon','public.my_creator_identity_snapshot()','execute') or has_function_privilege('service_role','public.my_creator_identity_snapshot()','execute');",
        ),
        "f",
      );
      assert.equal(
        sql(
          "select prosecdef from pg_proc where oid='public.my_creator_identity_snapshot()'::regprocedure;",
        ),
        "f",
      );
      for (const role of ["brand", "other", "admin", "staff"]) {
        const foreign = await snapshot(
          localClient(undefined, localJwt(accounts[role].id)),
        );
        assert.equal(foreign, null);
      }
    },
  );
  const insertIdentity = (
    id = identityId,
    key = externalId,
    record = recordId,
    provider = "youtube",
  ) =>
    `insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version) values('${id}','${record}','${provider}','${key}','가상 QA','https://example.org/fictional','2026-11-20T00:00:00Z','synthetic_demo','fixture-not-approved')`;
  sql(insertIdentity());
  await check(
    "provider/external ID uniqueness survives handle changes and rejects cross-record duplicates",
    async () => {
      rejected(insertIdentity(randomUUID()), "23505");
      const otherRecord = sql(
        "select id from adme_creator.records where legacy_creator_id='creator-002';",
      );
      rejected(insertIdentity(randomUUID(), externalId, otherRecord), "23505");
      const otherId = randomUUID();
      sql(
        `begin; ${insertIdentity(otherId, externalId, otherRecord, "instagram")}; rollback;`,
      );
      rejected(
        `${insertIdentity(otherId, `fictional-other-${otherId}`, otherRecord)}; update adme_creator.identities set claim_status='claimed' where id='${otherId}'`,
      );
      sql(
        `update adme_creator.identities set handle='new-fictional-handle' where id='${identityId}';`,
      );
      const entry = (await snapshot()).identities[0];
      assert.equal(entry.identity.id, identityId);
      assert.equal(entry.identity.externalId, externalId);
      assert.equal(entry.identity.handle, "new-fictional-handle");
      assert.equal(entry.identity.publicationStatus, "private");
      assert.equal(entry.identity.ownerId, ownerId);
      assert.equal(entry.sourceType, "synthetic_demo");
    },
  );
  const metric = (
    value,
    time,
    unit = "count",
    source = "https://example.org/fictional",
    kind = "original",
  ) =>
    `insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind) values('${identityId}','followers',${value},'${unit}','${time}','${source}','fixture-not-approved','${kind}')`;
  await check(
    "nullable time series preserves zero, source, policy and derived/original distinction",
    async () => {
      sql(
        `${metric("null", "2026-11-19T00:00:00Z")}; ${metric("0", "2026-11-20T00:00:00Z")}; ${metric("0", "2026-11-20T00:00:00Z", "count", "https://example.org/fictional", "derived")};`,
      );
      rejected(metric("1", "2026-11-20T00:00:00Z"), "23505");
      const entries = (await snapshot()).identities[0].metrics;
      assert.deepEqual(
        entries.map((m) => m.value),
        [0, 0, null],
      );
      assert.deepEqual(
        new Set(entries.map((m) => m.kind)),
        new Set(["original", "derived"]),
      );
      assert.ok(
        entries.every(
          (m) =>
            m.sourceUrl === "https://example.org/fictional" &&
            m.policyVersion === "fixture-not-approved",
        ),
      );
    },
  );
  await check(
    "DB constraints reject negative/non-finite/fractional/unsafe counts, invalid units, times and credential URLs",
    async () => {
      for (const [value, unit] of [
        ["-1", "count"],
        ["'NaN'::float8", "ratio"],
        ["'Infinity'::float8", "ratio"],
        ["0.5", "count"],
        ["9007199254740992", "count"],
        ["101", "percent"],
        ["1", "unknown"],
      ])
        rejected(metric(value, "2026-11-21T00:00:00Z", unit));
      for (const url of [
        "http://example.org/",
        "https://user:pass@example.org/",
        "https://example.org\\evil",
        "https:///empty-host",
        "https://example.org/has space",
      ])
        rejected(metric("1", "2026-11-21T00:00:00Z", "count", url));
      rejected(metric("1", "infinity"));
      rejected(
        `update adme_creator.identities set observed_at='infinity' where id='${identityId}'`,
      );
      rejected(
        `update adme_creator.identities set external_id=' ' where id='${identityId}'`,
      );
      rejected(
        `update adme_creator.identities set source_type='official_api' where id='${identityId}'`,
      );
      rejected(
        `update public.creators set profile=jsonb_set(profile,'{is_demo}','false') where id='${legacyId}'`,
      );
    },
  );
  await check(
    "publication requires owner, claim, consent and allowed state; parent moderation is always enforced",
    async () => {
      rejected(
        `update adme_creator.identities set publication_status='published' where id='${identityId}'`,
      );
      sql(
        `update adme_creator.identities set claim_status='claimed',owner_consent=true,publication_status='published' where id='${identityId}';`,
      );
      assert.equal(
        (await snapshot()).identities[0].identity.publicationStatus,
        "published",
      );
      sql(
        `update public.creators set moderation_status='restricted' where id='${legacyId}';`,
      );
      const entry = (await snapshot()).identities[0].identity;
      assert.equal(entry.publicationStatus, "private");
      assert.equal(entry.moderationStatus, "restricted");
      sql(
        `update public.creators set moderation_status='allowed' where id='${legacyId}';`,
      );
    },
  );
  await check(
    "bounded history reports truncation and returns the latest 200 observations in stable order",
    async () => {
      sql(`insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind)
      select '${identityId}','followers',n,'count','2026-12-01T00:00:00Z'::timestamptz+n*interval '1 second','https://example.org/fictional','fixture-not-approved','original' from generate_series(1,201) n;`);
      const entry = (await snapshot()).identities[0];
      assert.equal(entry.metricsTruncated, true);
      assert.equal(entry.metrics.length, 200);
      assert.equal(entry.metrics[0].value, 201);
      assert.equal(entry.metrics.at(-1).value, 2);
      sql(`insert into adme_creator.identities(creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version)
        select '${recordId}','youtube','fictional-bounded-${identityId}-'||n,'가상 QA','https://example.org/fictional',now(),'synthetic_demo','fixture-not-approved' from generate_series(1,50) n;`);
      const bounded = await snapshot();
      assert.equal(bounded.identities.length, 50);
      assert.equal(bounded.identitiesTruncated, true);
      sql(
        `delete from adme_creator.identities where creator_id='${recordId}' and id<>'${identityId}';`,
      );
    },
  );
  await check(
    "ownership transfer resets claim/consent/publication and denies the previous owner",
    async () => {
      sql(
        `update public.creators set owner_id='${nextOwnerId}' where id='${legacyId}';`,
      );
      assert.equal(await snapshot(), null);
      const transferred = (
        await snapshot(localClient(undefined, localJwt(nextOwnerId)))
      ).identities[0].identity;
      assert.equal(transferred.ownerId, nextOwnerId);
      assert.equal(transferred.claimStatus, "unclaimed");
      assert.equal(transferred.ownerConsent, false);
      assert.equal(transferred.publicationStatus, "private");
    },
  );
  await check(
    "deleting a legacy creator cascades all normalized private rows while preserving the 48 legacy fixtures",
    async () => {
      sql(`delete from public.creators where id='${legacyId}';`);
      for (const table of ["records", "identities", "metric_observations"])
        assert.equal(
          sql(`select count(*) from adme_creator.${table};`),
          table === "records"
            ? sql("select count(*) from public.creators;")
            : "0",
        );
      assert.equal(legacyHash(), originalHash);
    },
  );
} finally {
  sql(
    `delete from public.creators where id='${legacyId}'; delete from auth.users where id in ('${ownerId}','${nextOwnerId}');`,
  );
}
writeFileSync(
  "output/dev-a-db/creator-storage-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated fictional identities/metrics and synthetic local JWT authorization only; no approved provider integration",
      results,
    },
    null,
    2,
  ),
);
