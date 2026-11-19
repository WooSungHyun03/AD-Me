import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const ids = {
  brand: randomUUID(),
  creator: randomUUID(),
  other: randomUUID(),
  admin: randomUUID(),
};
const results = [];
const clients = Object.fromEntries(
  Object.entries(ids).map(([role, id]) => [
    role,
    localClient(undefined, localJwt(id)),
  ]),
);
const anon = localClient();
const creatorId = `user-${ids.creator}`;
let campaignId;
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,email,raw_user_meta_data) values('${id}', 'fixture-${id}@example.test', '{"role":"${role === "creator" ? "creator" : "brand"}","name":"QA isolated fixture"}');`,
    );
  sql(
    `select public.provision_administrator('${ids.admin}', 'LOCAL isolated permission fixture', now()+interval '1 hour');`,
  );
  const args = {
    p_name: "QA account",
    p_brand_name: "QA fictional brand",
    p_industry: "교육",
    p_introduction: "Fictional isolated test data",
    p_published: true,
    p_contact_name: "QA private contact",
    p_contact_email: "private@example.test",
    p_contact_visibility: "collaborators",
  };
  const saved = await clients.brand.rpc("save_brand_account", args);
  assert.equal(saved.error, null, "brand save transaction");
  const brandId = saved.data;
  await check(
    "public brand fields exclude contacts and owner ID, including direct REST",
    async () => {
      const dto = await anon
        .from("brand_profiles")
        .select("id,brand_name,industry,introduction,published")
        .eq("id", brandId)
        .single();
      assert.equal(dto.error, null);
      assert.equal(dto.data.brand_name, args.p_brand_name);
      for (const client of [anon, clients.other])
        assert.equal(
          (
            await client
              .from("brand_profiles")
              .select("owner_id")
              .eq("id", brandId)
          ).error?.code,
          "42501",
        );
      assert.ok((await anon.from("brand_contacts").select("*")).error);
      assert.equal(
        (await clients.other.from("brand_contacts").select("*")).data.length,
        0,
      );
    },
  );
  await check(
    "foreign account cannot edit another brand; creator cannot use brand RPC",
    async () => {
      assert.equal(
        (
          await clients.other
            .from("brand_profiles")
            .update({ brand_name: "forged" })
            .eq("id", brandId)
            .select("id")
        ).data.length,
        0,
      );
      assert.equal(
        (await clients.creator.rpc("save_brand_account", args)).error?.code,
        "42501",
      );
      assert.equal(
        (await clients.brand.rpc("my_brand_account")).data.brand_name,
        args.p_brand_name,
      );
      assert.equal((await clients.other.rpc("my_brand_account")).data, null);
    },
  );
  await check(
    "invalid private contact rolls back account name and public brand atomically",
    async () => {
      assert.ok(
        (
          await clients.brand.rpc("save_brand_account", {
            ...args,
            p_name: "SHOULD ROLLBACK",
            p_brand_name: "SHOULD ROLLBACK",
            p_contact_email: "invalid",
          })
        ).error,
      );
      assert.equal(
        (
          await clients.brand
            .from("profiles")
            .select("name")
            .eq("id", ids.brand)
            .single()
        ).data.name,
        args.p_name,
      );
      assert.equal(
        (await clients.brand.rpc("my_brand_account")).data.brand_name,
        args.p_brand_name,
      );
    },
  );
  const seed = (
    await anon
      .from("creators")
      .select("profile")
      .eq("id", "creator-001")
      .single()
  ).data.profile;
  assert.equal(
    (
      await clients.creator
        .from("creators")
        .insert({
          id: creatorId,
          owner_id: ids.creator,
          published: true,
          profile: { ...seed, name: "QA fictional identity", is_demo: false },
        })
    ).error,
    null,
  );
  const campaign = await clients.brand
    .from("campaigns")
    .insert({
      owner_id: ids.brand,
      status: "published",
      brief: {
        title: "QA isolated campaign",
        product: "fixture",
        category: "교육",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["instagram"],
        budget_krw: 100000,
        target_audience: "QA",
        goal: "테스트",
        status: "published",
      },
    })
    .select("id")
    .single();
  assert.equal(campaign.error, null);
  campaignId = campaign.data.id;
  const proposal = {
    campaign_id: campaignId,
    creator_id: creatorId,
    brand_id: ids.brand,
    creator_user_id: ids.creator,
    kind: "proposal",
    brief: "QA isolated collaboration contract",
  };
  const created = await clients.brand
    .from("proposals")
    .insert(proposal)
    .select("id")
    .single();
  assert.equal(created.error, null);
  await check(
    "contact sharing requires accepted participation and revocation is immediate",
    async () => {
      const params = { p_brand_id: brandId };
      assert.equal(
        (await clients.creator.rpc("brand_contact_for", params)).data.length,
        0,
      );
      assert.equal(
        (
          await clients.creator.rpc("transition_proposal", {
            p_id: created.data.id,
            p_action: "accepted",
          })
        ).error,
        null,
      );
      assert.equal(
        (await clients.creator.rpc("brand_contact_for", params)).data[0]
          .contact_email,
        args.p_contact_email,
      );
      assert.equal(
        (await clients.other.rpc("brand_contact_for", params)).data.length,
        0,
      );
      assert.equal(
        (
          await clients.brand
            .from("brand_contacts")
            .update({ visibility: "private" })
            .eq("owner_id", ids.brand)
        ).error,
        null,
      );
      assert.equal(
        (await clients.creator.rpc("brand_contact_for", params)).data.length,
        0,
      );
    },
  );
  await check(
    "campaign lock survives republish, blocks deletion and new proposals through REST",
    async () => {
      const params = {
        p_kind: "campaign",
        p_id: campaignId,
        p_published: false,
        p_reason: "QA isolated campaign lock",
      };
      assert.equal(
        (await clients.admin.rpc("moderate_entity", params)).error,
        null,
      );
      assert.equal(
        (
          await clients.brand
            .from("campaigns")
            .update({ status: "published" })
            .eq("id", campaignId)
        ).error,
        null,
      );
      assert.equal(
        (await anon.from("campaigns").select("id").eq("id", campaignId)).data
          .length,
        0,
      );
      assert.equal(
        (
          await clients.brand
            .from("campaigns")
            .update({ moderation_status: "allowed" })
            .eq("id", campaignId)
        ).error?.code,
        "42501",
      );
      assert.equal(
        (await clients.brand.from("campaigns").delete().eq("id", campaignId))
          .error?.code,
        "42501",
      );
      // Remove old fixture proposal to ensure the next rejection is RLS, not duplicate unique key.
      sql(
        `delete from public.audit_log where entity_id='${created.data.id}'; delete from public.proposals where id='${created.data.id}';`,
      );
      assert.equal(
        (await clients.brand.from("proposals").insert(proposal)).error?.code,
        "42501",
      );
      assert.equal(
        (
          await clients.admin.rpc("moderate_entity", {
            ...params,
            p_published: true,
          })
        ).error,
        null,
      );
      assert.equal(
        (await anon.from("campaigns").select("id").eq("id", campaignId)).data
          .length,
        1,
      );
    },
  );
  await check(
    "expired administrator approval denies even a fresh AAL2 JWT",
    async () => {
      sql(
        `update public.administrator_grants set granted_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id='${ids.admin}';`,
      );
      assert.equal((await clients.admin.rpc("is_admin")).data, false);
      assert.equal(
        (await clients.admin.from("moderation_events").select("*")).data.length,
        0,
      );
    },
  );
} finally {
  const list = Object.values(ids)
    .map((id) => `'${id}'`)
    .join(",");
  // Exactly these random local fixtures, never a hosted project or a blanket delete.
  sql(`begin;
    delete from public.moderation_events where actor_id in (${list});
    delete from public.audit_log where actor_id in (${list}) or entity_id in (${list});
    delete from public.proposals where brand_id in (${list});
    delete from public.campaigns where owner_id in (${list});
    delete from public.creators where owner_id in (${list});
    delete from public.brand_contacts where owner_id in (${list});
    delete from public.brand_profiles where owner_id in (${list});
    delete from public.administrator_grants where user_id in (${list});
    delete from auth.users where id in (${list}); commit;`);
  writeFileSync(
    "harness/evidence/DEV-A-P0-CONTINUE/local-brand-security.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "isolated Docker/PostgREST with synthetic locally signed role JWT fixtures; no external accounts/data",
        results,
      },
      null,
      2,
    ),
  );
}
