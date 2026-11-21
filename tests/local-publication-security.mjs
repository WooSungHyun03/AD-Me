import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import { enableLocalConsent } from "./support/consent-fixture.mjs";
import { publicationArgs } from "./support/publication-fixture.mjs";
localRuntime();
enableLocalConsent();
const ids = { creator: randomUUID(), brand: randomUUID(), other: randomUUID() };
const clients = Object.fromEntries(
  Object.entries(ids).map(([role, id]) => [
    role,
    localClient(undefined, localJwt(id)),
  ]),
);
const anon = localClient(),
  results = [];
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const profile = {
  name: "가상 공개 트랜잭션",
  bio: "격리된 로컬 가상 자료",
  categories: ["뷰티"],
  vibes: ["자연스러움"],
  formats: ["숏폼"],
  platforms: ["instagram"],
  price_min_krw: 0,
  price_max_krw: 10000,
  is_available: true,
  published: true,
  owner_consent: false,
};
const brand = {
  name: "가상 브랜드 계정",
  brandName: "가상 브랜드",
  industry: "교육",
  introduction: "격리된 가상 소개",
  published: true,
  contactName: "비공개 담당",
  contactEmail: "private@example.test",
  contactVisibility: "private",
};
let original;
const counts = () =>
  sql(
    `select (select count(*) from adme_consent.events where actor_id='${ids.brand}')::text||':'||(select count(*) from adme_consent.publication_requests where actor_id='${ids.brand}')::text;`,
  );
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data)values('${id}','{"role":"${role === "creator" ? "creator" : "brand"}","name":"가상 공개 QA"}');`,
    );
  await check(
    "approved policy + scoped creator save commits one event and one receipt under6 concurrent retries",
    async () => {
      original = publicationArgs("creator", profile);
      for (const client of [anon, clients.brand])
        assert.ok((await client.rpc("save_publication", original)).error);
      for (const bad of [
        { ...original, p_version: "retired" },
        { ...original, p_hash: "0".repeat(64) },
        publicationArgs("creator", { ...profile, owner_id: ids.other }),
        publicationArgs("creator", { ...profile, followers: 90000 }),
      ])
        assert.ok((await clients.creator.rpc("save_publication", bad)).error);
      const all = await Promise.all(
        Array.from({ length: 6 }, () =>
          clients.creator.rpc("save_publication", original),
        ),
      );
      for (const r of all) {
        assert.equal(r.error, null);
        assert.deepEqual(r.data, { id: "user-" + ids.creator });
      }
      assert.equal(
        sql(
          `select count(*) from adme_consent.events where actor_id='${ids.creator}' and accepted and scope='creator';`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select profile->>'followers' from public.creators where owner_id='${ids.creator}';`,
        ),
        "0",
      );
      assert.equal(
        sql(
          `select count(*) from adme_consent.publication_requests where actor_id='${ids.creator}';`,
        ),
        "1",
      );
    },
  );
  await check(
    "changed payload or cross-scope key is rejected; receipt replay after global withdrawal never republishes",
    async () => {
      assert.equal(
        (
          await clients.creator.rpc("save_publication", {
            ...original,
            p_data: { ...profile, bio: "changed" },
          })
        ).error?.code,
        "22023",
      );
      assert.equal(
        (
          await clients.creator.rpc("record_publication_consent", {
            p_version: original.p_version,
            p_hash: original.p_hash,
            p_key: original.p_key,
            p_accept: false,
          })
        ).error?.code,
        "22023",
      );
      const withdrawn = await clients.creator.rpc(
        "record_publication_consent",
        {
          p_version: original.p_version,
          p_hash: original.p_hash,
          p_key: randomUUID(),
          p_accept: false,
        },
      );
      assert.equal(withdrawn.error, null);
      assert.equal(
        (await clients.creator.rpc("save_publication", original)).error,
        null,
      );
      assert.equal(
        sql(
          `select published from public.creators where owner_id='${ids.creator}';`,
        ),
        "f",
      );
      const history = await clients.creator.rpc("my_consent_history_v2");
      assert.equal(history.error, null);
      assert.deepEqual(
        history.data.map((r) => [r.scope, r.accepted]),
        [
          ["global", false],
          ["creator", true],
        ],
      );
      assert.deepEqual(
        (await clients.other.rpc("my_consent_history_v2")).data,
        [],
      );
      assert.ok((await anon.rpc("my_consent_history_v2")).error);
    },
  );
  await check(
    "strict boundary rejects direct REST publication and old brand/logo RPCs, while direct privacy restrictions stay available",
    async () => {
      assert.equal(
        (
          await clients.creator
            .from("creators")
            .update({ published: true })
            .eq("owner_id", ids.creator)
        ).error?.code,
        "42501",
      );
      const saved = await clients.creator.rpc(
        "save_publication",
        publicationArgs("creator", profile),
      );
      assert.equal(saved.error, null);
      sql("update adme_consent.policies set active=false;");
      assert.equal(
        (
          await clients.creator
            .from("creators")
            .update({ published: false })
            .eq("owner_id", ids.creator)
        ).error,
        null,
      );
      assert.equal(
        sql(
          `select count(*) from adme_consent.events where actor_id='${ids.creator}' and not accepted and scope='creator';`,
        ),
        "1",
      );
      assert.ok(
        (
          await clients.creator.rpc(
            "save_publication",
            publicationArgs("creator", profile),
          )
        ).error,
      );
      enableLocalConsent();
      const legacy = {
        p_name: brand.name,
        p_brand_name: brand.brandName,
        p_industry: brand.industry,
        p_introduction: brand.introduction,
        p_published: true,
        p_contact_name: brand.contactName,
        p_contact_email: brand.contactEmail,
        p_contact_visibility: "private",
      };
      assert.equal(
        (await clients.brand.rpc("save_brand_account", legacy)).error?.code,
        "42501",
      );
      assert.equal(
        (
          await clients.brand.rpc("save_brand_account_logo", {
            ...legacy,
            p_logo: null,
          })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "brand contact, logo ownership or sensitive text failure rolls back name/profile/event/receipt atomically",
    async () => {
      const before = counts(),
        name = sql(`select name from public.profiles where id='${ids.brand}';`);
      for (const invalid of [
        { ...brand, contactEmail: "invalid" },
        { ...brand, logoUploadId: randomUUID() },
        { ...brand, introduction: "person@example.test" },
        { ...brand, owner_id: ids.other },
      ]) {
        const r = await clients.brand.rpc(
          "save_publication",
          publicationArgs("brand", invalid),
        );
        assert.ok(r.error);
        assert.equal(counts(), before);
        assert.equal(
          sql(`select name from public.profiles where id='${ids.brand}';`),
          name,
        );
        assert.equal(
          sql(
            `select count(*) from public.brand_profiles where owner_id='${ids.brand}';`,
          ),
          "0",
        );
      }
      const args = publicationArgs("brand", brand);
      const r = await clients.brand.rpc("save_publication", args);
      assert.equal(r.error, null);
      assert.ok(r.data.brandId);
      assert.equal(
        (await clients.brand.rpc("save_publication", args)).error,
        null,
      );
      assert.equal(counts(), "1:1");
      assert.ok((await anon.from("brand_contacts").select("*")).error);
      sql("update adme_consent.policies set active=false;");
      assert.equal(
        (
          await clients.brand.rpc(
            "save_publication",
            publicationArgs("brand", { ...brand, published: false }),
          )
        ).error,
        null,
      );
      assert.equal(
        sql(
          `select published from public.brand_profiles where owner_id='${ids.brand}';`,
        ),
        "f",
      );
      enableLocalConsent();
    },
  );
  await check(
    "private receipts/boundary cannot be read or changed by app roles and Auth removal cleans scoped artifacts",
    async () => {
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_consent.publication_requests','select') or has_table_privilege('${role}','adme_consent.publication_requests','update');`,
          ),
          "f",
        );
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_consent.activate_publication(text)','execute');`,
          ),
          "f",
        );
      }
      sql(
        `delete from public.brand_contacts where owner_id='${ids.brand}';delete from public.brand_profiles where owner_id='${ids.brand}';delete from auth.users where id='${ids.brand}';`,
      );
      assert.equal(counts(), "0:0");
    },
  );
  await check(
    "replayed global withdrawal cannot undo a later scoped save and v2 reports a stale receipt honestly",
    async () => {
      const key = randomUUID(),
        args = {
          p_version: original.p_version,
          p_hash: original.p_hash,
          p_accept: false,
          p_key: key,
        };
      const first = await clients.creator.rpc(
        "record_publication_consent_v2",
        args,
      );
      assert.equal(first.error, null);
      assert.equal(first.data.currentWithdrawal, true);
      assert.equal(
        (
          await clients.creator.rpc(
            "save_publication",
            publicationArgs("creator", profile),
          )
        ).error,
        null,
      );
      const retry = await clients.creator.rpc(
        "record_publication_consent_v2",
        args,
      );
      assert.equal(retry.error, null);
      assert.equal(retry.data.id, first.data.id);
      assert.equal(retry.data.currentWithdrawal, false);
      assert.equal(
        sql(
          `select published from public.creators where owner_id='${ids.creator}';`,
        ),
        "t",
      );
      const legacy = await clients.creator.rpc(
        "record_publication_consent",
        args,
      );
      assert.equal(legacy.error, null);
      assert.equal(
        sql(
          `select published from public.creators where owner_id='${ids.creator}';`,
        ),
        "t",
      );
      assert.equal(
        (
          await clients.creator.rpc("record_publication_consent_v2", {
            ...args,
            p_key: randomUUID(),
          })
        ).data.currentWithdrawal,
        true,
      );
    },
  );
} finally {
  enableLocalConsent();
  for (const id of Object.values(ids))
    sql(
      `delete from public.brand_contacts where owner_id='${id}';delete from public.brand_profiles where owner_id='${id}';delete from public.creators where owner_id='${id}';delete from adme_ops.rate_windows where subject='${id}';delete from auth.users where id='${id}';`,
    );
}
writeFileSync(
  "output/dev-a-db/publication-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      results,
      scope:
        "Actual loopback Postgres/PostgREST, fictional profiles/policy approval and synthetic local role tokens. No provider/legal/deployment verification.",
    },
    null,
    2,
  ) + "\n",
);
