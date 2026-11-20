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
const owner = randomUUID(),
  id = `local-youtube-${randomUUID()}`,
  channel = "UC" + "A".repeat(22);
const anon = localClient(),
  brand = localClient(undefined, localJwt(a.brand.id)),
  admin = localClient(undefined, localJwt(a.admin.id));
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
try {
  sql(`insert into auth.users(id,raw_user_meta_data) values('${owner}','{"role":"creator","name":"Local fictional channel owner"}');
 insert into public.creators(id,owner_id,published,profile) select '${id}','${owner}',true,profile||'{"name":"Fictional channel fixture","is_demo":false}'::jsonb from public.creators where owner_id is null limit 1;
 insert into adme_ops.channels(channel_id,title,review) values('${channel}','Fictional channel fixture','accepted');
 insert into adme_ops.channel_claims(owner_id,channel_id,verified_at,consent_at) values('${owner}','${channel}',now(),now());
 delete from adme_ops.rate_windows where scope='youtube_search';`);
  await check(
    "public YouTube DTO excludes owner/contacts and honors moderation even after owner republication",
    async () => {
      const visible = await anon.rpc("ops_public_channels", {
        p_query: "Fictional channel fixture",
      });
      assert.equal(visible.error, null);
      assert.equal(visible.data.length, 1);
      assert.deepEqual(
        Object.keys(visible.data[0]).sort(),
        [
          "channel_id",
          "title",
          "subscriber_count",
          "fetched_at",
          "creator_id",
        ].sort(),
      );
      assert.equal(
        (
          await admin.rpc("moderate_entity", {
            p_kind: "creator",
            p_id: id,
            p_published: false,
            p_reason: "Local fictional lock check",
          })
        ).error,
        null,
      );
      sql(`update public.creators set published=true where id='${id}';`);
      assert.deepEqual(
        (
          await anon.rpc("ops_public_channels", {
            p_query: "Fictional channel fixture",
          })
        ).data,
        [],
      );
      assert.equal(
        (
          await admin.rpc("moderate_entity", {
            p_kind: "creator",
            p_id: id,
            p_published: true,
            p_reason: "Local fictional release check",
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await anon.rpc("ops_public_channels", {
            p_query: "Fictional channel fixture",
          })
        ).data.length,
        1,
      );
      sql(
        `update adme_ops.channel_claims set consent_at=null where owner_id='${owner}';`,
      );
      assert.deepEqual(
        (
          await anon.rpc("ops_public_channels", {
            p_query: "Fictional channel fixture",
          })
        ).data,
        [],
      );
    },
  );
  await check(
    "direct search RPC admits60 of65 concurrent account calls and returns429 with exact retry metadata",
    async () => {
      const calls = await Promise.all(
        Array.from({ length: 65 }, () =>
          brand.rpc("ops_public_channels", { p_query: "Fictional" }),
        ),
      );
      assert.equal(calls.filter((r) => !r.error).length, 60);
      assert.ok(
        calls
          .filter((r) => r.error)
          .every(
            (r) =>
              r.status === 429 &&
              r.error.code === "PT429" &&
              JSON.parse(r.error.details).retryAfter > 0,
          ),
      );
      assert.equal(
        (await anon.rpc("ops_public_channels", { p_query: "Fictional" })).error,
        null,
      );
    },
  );
} finally {
  sql(
    `delete from public.moderation_events where entity_id='${id}'; delete from public.audit_log where entity_id='${id}'; delete from adme_ops.channel_claims where owner_id='${owner}'; delete from adme_ops.channels where channel_id='${channel}'; delete from public.creators where id='${id}'; delete from auth.users where id='${owner}'; delete from adme_ops.rate_windows where scope='youtube_search';`,
  );
}
writeFileSync(
  "output/dev-a-db/youtube-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated fictional SQL ownership/consent fixtures; no real YouTube verification",
      results,
    },
    null,
    2,
  ),
);
