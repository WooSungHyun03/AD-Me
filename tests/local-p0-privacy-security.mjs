import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync, readFileSync } from "node:fs";
import sharp from "sharp";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import { cleanImageFixtures } from "./support/image-fixture-cleanup.mjs";
localRuntime();
const runtime = localRuntime(),
  ids = { brand: randomUUID(), creator: randomUUID(), other: randomUUID() },
  creatorId = "user-" + ids.creator,
  campaign = randomUUID(),
  room = randomUUID(),
  image = randomUUID(),
  identity = randomUUID();
const [brand, creator, other] = Object.values(ids).map((id) =>
    localClient(undefined, localJwt(id)),
  ),
  anon = localClient(),
  service = localClient(runtime.SERVICE_ROLE_KEY),
  results = [];
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
let ref, descriptor;
const png = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#d7ff45" },
  })
    .png()
    .toBuffer(),
  hash = createHash("sha256").update(png).digest("hex");
try {
  for (const [kind, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${kind === "creator" ? "creator" : "brand"}","name":"가상 privacy QA"}');`,
    );
  const base = JSON.parse(
    readFileSync("fixtures/creators.demo.json", "utf8"),
  )[0];
  sql(
    `insert into public.creators(id,owner_id,published,profile) values('${creatorId}','${ids.creator}',true,'${literal({ ...base, name: "가상 opaque QA", is_demo: false, owner_consent: true, metrics_source: "unavailable", private_email: "P0_SECRET_CANARY" })}');insert into public.campaigns(id,owner_id,brief,status) select '${campaign}','${ids.brand}',brief,'published' from public.campaigns limit 1;insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${creatorId}','${ids.brand}','${ids.creator}','proposal','Fictional private image room','accepted');`,
  );
  await check(
    "public references are stable opaque IDs, legacy lookups work and no original actor IDs leak from public DTOs",
    async () => {
      ref = sql(`select adme_creator.public_reference('${creatorId}');`);
      assert.match(ref, /^c-[a-f0-9-]{36}$/);
      assert.ok(!ref.includes(ids.creator));
      assert.equal(
        sql(
          `begin;insert into public.creators(id,published,profile) select '${ref}',false,profile from public.creators where id='${creatorId}';select adme_creator.resolve_reference('${ref}')='${creatorId}';rollback;`,
        )
          .split("\n")
          .includes("t"),
        true,
      );
      for (const id of [ref, creatorId]) {
        const r = await anon.rpc("creator_public_one", { p_ref: id });
        assert.equal(r.error, null);
        assert.equal(r.data.seed_id, ref);
        assert.ok(!JSON.stringify(r.data).includes(ids.creator));
        assert.ok(!JSON.stringify(r.data).includes("P0_SECRET_CANARY"));
      }
      const concurrent = await Promise.all(
        Array.from({ length: 8 }, () =>
          anon.rpc("creator_home_summary", { p_demo: false }),
        ),
      );
      for (const r of concurrent) {
        assert.equal(r.error, null);
        assert.ok(!JSON.stringify(r.data).includes(ids.creator));
      }
      assert.equal(
        (await brand.rpc("toggle_saved_creator", { p_ref: ref })).data,
        true,
      );
      const saved = await brand.rpc("my_saved_creator_catalog");
      assert.equal(saved.data[0].creator_id, ref);
      assert.equal(
        (await brand.rpc("toggle_saved_creator", { p_ref: creatorId })).data,
        false,
      );
      const choices = await brand.rpc("creator_proposal_choices", {
        p_campaign: campaign,
      });
      assert.ok(choices.data.some((c) => c.id === ref));
      assert.ok(!JSON.stringify(choices.data).includes(ids.creator));
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_creator.activate_public_refs(text)','execute');`,
          ),
          "f",
        );
      assert.throws(
        () => sql("update adme_creator.reference_boundary set enabled=false;"),
        /check_violation|check constraint|raise/i,
      );
    },
  );
  await check(
    "actual Storage private images require a participant reservation, service verification and immutable bytes",
    async () => {
      const args = {
        p_id: image,
        p_purpose: "message_image",
        p_proposal: room,
        p_name: "가상 이미지.png",
        p_sha256: hash,
        p_bytes: png.length,
      };
      assert.equal(
        (await other.rpc("image_upload_reserve", args)).error?.code,
        "42501",
      );
      const reserved = await creator.rpc("image_upload_reserve", args);
      assert.equal(reserved.error, null);
      descriptor = reserved.data;
      assert.equal(
        (
          await creator.rpc("image_upload_verify", {
            p_id: image,
            p_owner: ids.creator,
            p_hash: hash,
            p_bytes: png.length,
          })
        ).error?.code,
        "42501",
      );
      assert.ok(
        (
          await other.storage
            .from("adme-private-images")
            .upload(descriptor.path, png, { contentType: "image/png" })
        ).error,
      );
      assert.equal(
        (
          await creator.storage
            .from("adme-private-images")
            .upload(descriptor.path, png, { contentType: "image/png" })
        ).error,
        null,
      );
      assert.equal(
        (await creator.rpc("image_message_publish", { p_id: image })).error
          ?.code,
        "42501",
      );
      assert.equal(
        (
          await service.rpc("image_upload_verify", {
            p_id: image,
            p_owner: ids.creator,
            p_hash: hash,
            p_bytes: png.length,
          })
        ).error,
        null,
      );
      const sent = await creator.rpc("image_message_publish", { p_id: image });
      assert.equal(sent.error, null);
      assert.equal(
        (await creator.rpc("image_message_publish", { p_id: image })).data,
        sent.data,
      );
      assert.equal(
        (
          await brand.storage
            .from("adme-private-images")
            .download(descriptor.path)
        ).error,
        null,
      );
      assert.ok(
        (
          await creator.storage
            .from("adme-private-images")
            .upload(descriptor.path, png, {
              contentType: "image/png",
              upsert: true,
            })
        ).error,
      );
      assert.ok(
        (
          await other.storage
            .from("adme-private-images")
            .download(descriptor.path)
        ).error,
      );
      assert.equal(
        (await other.rpc("image_file_access", { p_id: image })).error?.code,
        "42501",
      );
      assert.equal(
        (
          await creator.rpc("image_upload_reserve", {
            ...args,
            p_sha256: "a".repeat(64),
          })
        ).error?.code,
        "23505",
      );
    },
  );
  await check(
    "block/moderation revoke file access in both app RPC and direct Storage without deleting history",
    async () => {
      sql(
        `insert into adme_messaging.blocks(proposal_id,actor_id) values('${room}','${ids.brand}');`,
      );
      assert.equal(
        (await creator.rpc("image_file_access", { p_id: image })).error?.code,
        "42501",
      );
      assert.ok(
        (
          await creator.storage
            .from("adme-private-images")
            .download(descriptor.path)
        ).error,
      );
      assert.equal(
        (await brand.rpc("image_room_files", { p_room: room })).data.length,
        1,
      );
      sql(
        `delete from adme_messaging.blocks where proposal_id='${room}';update public.creators set moderation_status='restricted' where id='${creatorId}';`,
      );
      assert.equal(
        (await brand.rpc("image_file_access", { p_id: image })).error?.code,
        "42501",
      );
      sql(
        `update public.creators set moderation_status='allowed' where id='${creatorId}';`,
      );
    },
  );
  await check(
    "normalized observations require approved policy/claim/consent, preserve zero and null, hide stale and private fields",
    async () => {
      sql(`insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version,claim_status,owner_consent,publication_status) select '${identity}',id,'youtube','fictional-${identity}','가상 정규화 지표','https://www.youtube.com/@fictionalPolicyQA',now(),'official_api','local-policy-only','claimed',true,'published' from adme_creator.records where legacy_creator_id='${creatorId}';
  insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind) values('${identity}','followers',0,'count',now(),'https://www.youtube.com/@fictionalPolicyQA','local-policy-only','original'),('${identity}','views',null,'count',now(),'https://www.youtube.com/@fictionalPolicyQA','local-policy-only','original'),('${identity}','private_count',999,'count',now(),'https://www.youtube.com/@fictionalPolicyQA','local-policy-only','original');`);
      assert.equal(
        (await anon.rpc("creator_normalized_public", { p_ref: ref })).data
          .identities.length,
        0,
      );
      sql(
        `insert into adme_creator.publication_policies(provider,policy_version,enabled,permission_ref,ttl_seconds,metric_units) values('youtube','local-policy-only',true,'fictional-local-policy-not-approval',3600,'{"followers":"count","views":"count"}');`,
      );
      const r = await anon.rpc("creator_normalized_public", { p_ref: ref });
      assert.equal(r.error, null);
      assert.equal(
        r.data.identities[0].metrics.find((m) => m.name === "followers").value,
        0,
      );
      assert.equal(
        r.data.identities[0].metrics.find((m) => m.name === "views").value,
        null,
      );
      for (const value of [
        "ownerId",
        "owner_id",
        "ownerConsent",
        "externalId",
        "private_count",
        ids.creator,
        "P0_SECRET_CANARY",
      ])
        assert.ok(!JSON.stringify(r.data).includes(value));
      sql(
        `update adme_creator.metric_observations set observed_at=now()-interval '2 hours' where identity_id='${identity}' and name='followers';`,
      );
      const stale = await anon.rpc("creator_normalized_public", { p_ref: ref });
      assert.equal(
        stale.data.identities[0].metrics.find((m) => m.name === "followers")
          .value,
        null,
      );
      assert.equal(
        stale.data.identities[0].metrics.find((m) => m.name === "followers")
          .stale,
        true,
      );
      sql(
        `update public.creators set profile=jsonb_set(profile,'{owner_consent}','false') where id='${creatorId}';`,
      );
      assert.equal(
        (await anon.rpc("creator_normalized_public", { p_ref: ref })).data
          .identities.length,
        0,
      );
    },
  );
  await check(
    "auth hashed budgets are service-only, atomic per account and shared fallback cannot select arbitrary subjects",
    async () => {
      const subject = createHash("sha256").update(ids.other).digest("hex");
      assert.equal(
        (
          await anon.rpc("auth_edge_budget", {
            p_action: "login",
            p_ip: subject,
            p_account: subject,
          })
        ).error?.code,
        "42501",
      );
      const attempts = await Promise.all(
        Array.from({ length: 13 }, () =>
          service.rpc("auth_edge_budget", {
            p_action: "login",
            p_ip: subject,
            p_account: subject,
          }),
        ),
      );
      for (const r of attempts) assert.equal(r.error, null);
      assert.equal(attempts.filter((r) => r.data.allowed).length, 10);
      assert.equal(
        sql(
          `select count(*) from adme_ops.rate_windows where subject='${ids.other}';`,
        ),
        "0",
      );
      sql(`delete from adme_ops.rate_windows where subject='${subject}';`);
      assert.equal(
        (await anon.rpc("auth_shared_budget", { p_action: "unknown" })).error
          ?.code,
        "22023",
      );
    },
  );
} finally {
  await cleanImageFixtures(Object.values(ids));
  sql(
    `delete from adme_messaging.blocks where proposal_id='${room}';delete from public.audit_log where actor_id in('${ids.brand}','${ids.creator}','${ids.other}');delete from public.messages where proposal_id='${room}';delete from public.proposals where id='${room}';delete from public.campaigns where id='${campaign}';delete from public.saved_creators where owner_id='${ids.brand}';delete from public.creators where id='${creatorId}';delete from adme_creator.publication_policies where policy_version='local-policy-only';delete from adme_ops.rate_windows where subject in('${ids.brand}','${ids.creator}','${ids.other}');delete from auth.users where id in('${ids.brand}','${ids.creator}','${ids.other}');`,
  );
}
writeFileSync(
  "output/dev-a-db/p0-privacy-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      results,
      scope:
        "Actual isolated PostgreSQL/PostgREST/Storage. Fictional claims/policy/PNG and locally signed role tokens; no provider approval or hosted operations.",
    },
    null,
    2,
  ),
);
