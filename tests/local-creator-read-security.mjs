// Actual isolated local PostgreSQL/PostgREST. All people/TEST entitlements are fixtures.
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
const a = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const ids = { brand: randomUUID(), other: randomUUID(), owner: randomUUID() };
const creatorId = `user-${ids.owner}`,
  campaign = randomUUID(),
  secondCampaign = randomUUID();
const marker = `FICTIONAL_PRIVATE_${randomUUID()}`;
const anon = localClient(),
  brand = localClient(undefined, localJwt(ids.brand)),
  owner = localClient(undefined, localJwt(ids.owner)),
  other = localClient(undefined, localJwt(ids.other)),
  admin = localClient(undefined, localJwt(a.admin.id));
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
async function catalog(client = anon, limit = 200) {
  const result = await client.rpc("creator_catalog_page", {
    p_after: "",
    p_limit: limit,
  });
  assert.equal(result.error, null);
  return result.data.items;
}
const hash = () =>
  sql(
    "select md5(string_agg(id||profile::text,',' order by id)) from public.creators where id like 'creator-%';",
  );
const before = hash();
const initialPublicCount=Number(sql("select count(*) from public.creators c where adme_creator.catalog_dto(c) is not null;"));
const initialOwnedPublicCount=Number(sql("select count(*) from public.creators c where c.owner_id is not null and adme_creator.catalog_dto(c) is not null;"));
let publicId;
const previousBilling=sql("select enabled from adme_release.billing_boundary;");
try {
  sql("select adme_release.set_test_billing(true,'local-read-security-qa');");
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${role === "owner" ? "creator" : "brand"}","name":"가상 읽기 경계 QA"}');`,
    );
  sql(`insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${ids.owner}',true,
    profile||jsonb_build_object('name','가상 읽기 경계 QA','is_demo',false,'followers',0,'metrics_source','unavailable','owner_id','${ids.owner}',
      'owner_consent',true,'email','${marker}','oauth_token','${marker}','private_extra',jsonb_build_object('note','${marker}'),
      'social_url','https://www.youtube.com/watch?v=abcdefghijk','portfolio_url','https://example.org/fictional') from public.creators where id='creator-001';
    insert into public.campaigns(id,owner_id,brief,status) select '${campaign}','${ids.brand}',brief,'published' from public.campaigns limit 1;
    insert into public.campaigns(id,owner_id,brief,status) select '${secondCampaign}','${ids.brand}',brief,'published' from public.campaigns limit 1;`);
  publicId=sql(`select adme_creator.public_reference('${creatorId}');`);
  assert.ok(!publicId.includes(ids.owner));
  await check(
    "anonymous and foreign raw reads are denied while own settings and fresh approved admin remain compatible",
    async () => {
      assert.equal(
        (await anon.from("creators").select("*")).error?.code,
        "42501",
      );
      assert.deepEqual(
        (await brand.from("creators").select("*").eq("id", creatorId)).data,
        [],
      );
      assert.equal(
        (
          await owner
            .from("creators")
            .select("profile")
            .eq("id", creatorId)
            .single()
        ).data.profile.email,
        marker,
      );
      assert.equal(
        (
          await admin
            .from("creators")
            .select("profile")
            .eq("id", creatorId)
            .single()
        ).data.profile.email,
        marker,
      );
      const roleOnly = localClient(
        undefined,
        localJwt(a.admin.id, {
          aal: "aal1",
          amr: [
            { method: "password", timestamp: Math.floor(Date.now() / 1000) },
          ],
        }),
      );
      assert.deepEqual(
        (await roleOnly.from("creators").select("*").eq("id", creatorId)).data,
        [],
      );
    },
  );
  await check(
    "direct public RPC returns only allowlisted fields, keeps legacy URLs and preserves null versus demo zero",
    async () => {
      const rows = await catalog();
      const row = rows.find((c) => c.seed_id === publicId);
      assert.ok(row);
      assert.equal(row.followers, null);
      assert.equal(
        row.source_url,
        "https://www.youtube.com/watch?v=abcdefghijk",
      );
      assert.equal(row.social_url, row.source_url);
      assert.equal(row.portfolio_url, "https://example.org/fictional");
      for (const key of [
        "owner_id",
        "owner_consent",
        "email",
        "oauth_token",
        "private_extra",
      ])
        assert.ok(!(key in row));
      assert.ok(!JSON.stringify(rows).includes(marker));
      assert.equal(rows.filter((c) => c.is_demo).length, 48);
      assert.equal(
        (await anon.schema("adme_creator").rpc("catalog_dto", { p_row: {} }))
          .error?.code,
        "PGRST106",
      );
    },
  );
  await check(
    "cursor pages are bounded/stable with no duplicates and reject invalid limits/cursors",
    async () => {
      let after = "";
      const seen = [];
      for (let n = 0; n < 10; n++) {
        const response = await anon.rpc("creator_catalog_page", {
          p_after: after,
          p_limit: 7,
        });
        assert.equal(response.error, null);
        assert.ok(response.data.items.length <= 7);
        seen.push(...response.data.items.map((c) => c.seed_id));
        if (!response.data.nextCursor) break;
        after = response.data.nextCursor;
      }
      assert.equal(seen.length, initialPublicCount+1);
      assert.equal(new Set(seen).size, initialPublicCount+1);
      for (const limit of [0, 201])
        assert.equal(
          (
            await anon.rpc("creator_catalog_page", {
              p_after: "",
              p_limit: limit,
            })
          ).error?.code,
          "22023",
        );
      assert.equal(
        (
          await anon.rpc("creator_catalog_page", {
            p_after: "x".repeat(101),
            p_limit: 10,
          })
        ).error?.code,
        "22023",
      );
    },
  );
  await check(
    "saved foreign embeds cannot bypass RLS; own saved RPC/CSV projection contains public fields only",
    async () => {
      assert.equal(
        (
          await brand
            .from("saved_creators")
            .insert({ owner_id: ids.brand, creator_id: creatorId })
        ).error,
        null,
      );
      const embedded = await brand
        .from("saved_creators")
        .select("creator_id,creators(profile)");
      assert.equal(embedded.error, null);
      assert.equal(embedded.data[0].creators, null);
      const saved = await brand.rpc("my_saved_creator_catalog");
      assert.equal(saved.error, null);
      assert.equal(saved.data[0].creator_id, publicId);
      assert.equal(saved.data[0].creator.name, "가상 읽기 경계 QA");
      assert.ok(!JSON.stringify(saved.data).includes(marker));
      assert.deepEqual((await other.rpc("my_saved_creator_catalog")).data, []);
      assert.equal(
        (await anon.rpc("my_saved_creator_catalog")).error?.code,
        "42501",
      );
    },
  );
  await check(
    "proposal choices reveal only id/name for authorized campaign actors; foreign/anonymous access is denied",
    async () => {
      const choices = await brand.rpc("creator_proposal_choices", {
        p_campaign: campaign,
      });
      assert.equal(choices.error, null);
      assert.equal(choices.data.length,initialOwnedPublicCount+1);
      assert.ok(choices.data.some(c=>c.id===publicId&&c.name==='가상 읽기 경계 QA'));
      for(const choice of choices.data)assert.deepEqual(Object.keys(choice).sort(),['id','name']);
      assert.deepEqual(
        (await other.rpc("creator_proposal_choices", { p_campaign: campaign }))
          .data,
        [],
      );
      assert.deepEqual(
        (await owner.rpc("creator_proposal_choices", { p_campaign: campaign }))
          .data,
        [{id:publicId,name:'가상 읽기 경계 QA'}],
      );
      assert.equal(
        (await anon.rpc("creator_proposal_choices", { p_campaign: campaign }))
          .error?.code,
        "42501",
      );
    },
  );
  await check(
    "atomic create preserves proposal IDs/status, rejects duplicates/forgeries and supports old direct REST RLS",
    async () => {
      const args = {
        p_campaign: campaign,
        p_creator: creatorId,
        p_kind: "proposal",
        p_brief: "가상 QA 협업 요청 검증입니다.",
      };
      const pair = await Promise.all([
        brand.rpc("create_creator_proposal", args),
        brand.rpc("create_creator_proposal", args),
      ]);
      assert.equal(pair.filter((r) => r.error === null).length, 1);
      assert.equal(pair.find((r) => r.error)?.error.code, "23505");
      const proposal = await brand
        .from("proposals")
        .select("creator_id,status")
        .eq("id", pair.find((r) => r.error === null).data)
        .single();
      assert.equal(proposal.data.creator_id, creatorId);
      assert.equal(proposal.data.status, "pending");
      assert.equal(
        (
          await other.rpc("create_creator_proposal", {
            ...args,
            p_campaign: secondCampaign,
          })
        ).error?.code,
        "42501",
      );
      sql(
        `update public.campaigns set status='draft' where id='${secondCampaign}';`,
      );
      const hidden = await other.rpc("create_creator_proposal", {
        ...args,
        p_campaign: secondCampaign,
      });
      const missing = await other.rpc("create_creator_proposal", {
        ...args,
        p_campaign: randomUUID(),
      });
      assert.equal(hidden.error?.code, "23514");
      assert.equal(hidden.error?.code, missing.error?.code);
      assert.equal(hidden.error?.message, missing.error?.message);
      assert.equal(
        (
          await brand.rpc("create_creator_proposal", {
            ...args,
            p_kind: null,
          })
        ).error?.code,
        "42501",
      );
      sql(
        `update public.campaigns set status='published' where id='${secondCampaign}';`,
      );
      assert.equal(
        (
          await brand.from("proposals").insert({
            campaign_id: secondCampaign,
            creator_id: creatorId,
            brand_id: ids.brand,
            creator_user_id: ids.owner,
            kind: "proposal",
            brief: args.p_brief,
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await other.from("proposals").insert({
            campaign_id: secondCampaign,
            creator_id: creatorId,
            brand_id: ids.other,
            creator_user_id: ids.owner,
            kind: "proposal",
            brief: args.p_brief,
          })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "HOT uses the same safe projection; isolated TEST entitlement fixture is not a provider payment verification",
    async () => {
      sql(`with o as(insert into public.orders(owner_id,sku,amount,status) values('${ids.owner}','creator_hot',9900,'paid') returning id)
      insert into public.entitlements(owner_id,order_id,sku,expires_at) select '${ids.owner}',id,'creator_hot',now()+interval '1 day' from o;`);
      const hot = await anon.rpc("active_hot_creators");
      assert.equal(hot.error, null);
      assert.equal(hot.data[0].creator_id, publicId);
      assert.ok(!JSON.stringify(hot.data).includes(marker));
      assert.ok(!("owner_id" in hot.data[0].profile));
    },
  );
  await check(
    "moderation survives republish and gates public/saved/HOT/choices/create while retaining private ownership",
    async () => {
      assert.equal(
        (
          await admin.rpc("moderate_entity", {
            p_kind: "creator",
            p_id: creatorId,
            p_published: false,
            p_reason: "가상 읽기 경계 검사",
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await owner
            .from("creators")
            .update({ published: true })
            .eq("id", creatorId)
        ).error,
        null,
      );
      assert.equal(
        (await catalog()).some((c) => c.seed_id === publicId),
        false,
      );
      assert.equal(
        (await brand.rpc("my_saved_creator_catalog")).data[0].creator,
        null,
      );
      assert.ok(!(await anon.rpc("active_hot_creators")).data.some(c=>c.creator_id===publicId));
      const remainingChoices=(await brand.rpc("creator_proposal_choices", { p_campaign: campaign })).data;
      assert.equal(remainingChoices.length,initialOwnedPublicCount);
      assert.ok(!remainingChoices.some(c=>c.id===publicId));
      assert.equal(
        (
          await brand.rpc("create_creator_proposal", {
            p_campaign: campaign,
            p_creator: creatorId,
            p_kind: "proposal",
            p_brief: "가상 잠금 우회 거부 검사입니다.",
          })
        ).error?.code,
        "23514",
      );
      assert.equal(
        (await owner.from("creators").select("id").eq("id", creatorId)).data
          .length,
        1,
      );
      assert.equal(hash(), before);
    },
  );
} finally {
  sql(`select adme_release.set_test_billing(${previousBilling==='t'},'local-read-security-restored');`);
  sql(`delete from public.proposals where brand_id in ('${ids.brand}','${ids.other}'); delete from public.campaigns where id in ('${campaign}','${secondCampaign}');
    delete from public.saved_creators where owner_id in ('${ids.brand}','${ids.other}'); delete from public.entitlements where owner_id='${ids.owner}'; delete from public.orders where owner_id='${ids.owner}';
    delete from public.moderation_events where entity_id='${creatorId}'; delete from public.audit_log where entity_id='${creatorId}'; delete from public.creators where id='${creatorId}';
    delete from auth.users where id in ('${ids.brand}','${ids.other}','${ids.owner}');`);
}
writeFileSync(
  "output/dev-a-db/creator-read-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "fictional isolated Auth/REST fixtures; HOT entitlement is a DB authorization fixture only, not Toss/provider validation; legacy IDs retained",
      results,
    },
    null,
    2,
  ),
);
