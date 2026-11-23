import { cleanDeliveryFixtures } from "./support/delivery-fixture-cleanup.mjs";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const ids = { brand: randomUUID(), creator: randomUUID(), other: randomUUID() };
const room = randomUUID(),
  campaign = randomUUID(),
  creatorId = `user-${ids.creator}`;
const clients = Object.fromEntries(
  Object.entries(ids).map(([k, id]) => [
    k,
    localClient(undefined, localJwt(id)),
  ]),
);
const { brand, creator, other } = clients,
  anon = localClient(),
  results = [];
const send = (client, key = randomUUID(), extra = {}) =>
  client.rpc("conversation_send", {
    p_proposal: room,
    p_key: key,
    p_body: "FICTIONAL private message",
    p_kind: "message",
    p_url: null,
    ...extra,
  });
const page = (client, extra = {}) =>
  client.rpc("conversation_page", { p_proposal: room, ...extra });
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const clearSend = () =>
  sql(
    `delete from adme_ops.rate_windows where subject in ('${ids.brand}','${ids.creator}') and scope in ('message_minute','message_day');`,
  );
let firstId, retryKey;
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${role === "creator" ? "creator" : "brand"}","name":"가상 메시지 QA"}');`,
    );
  sql(`insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${ids.creator}',true,profile from public.creators limit 1;
    insert into public.campaigns(id,owner_id,brief) select '${campaign}','${ids.brand}',brief from public.campaigns limit 1;
    insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${room}','${campaign}','${creatorId}','${ids.brand}','${ids.creator}','proposal','Fictional message QA collaboration','accepted');`);
  await check(
    "anon/foreign cannot read, send, block, report or inspect private safety tables",
    async () => {
      for (const client of [anon, other]) {
        assert.equal((await page(client)).error?.code, "42501");
        assert.equal((await send(client)).error?.code, "42501");
        assert.equal(
          (
            await client.rpc("conversation_block", {
              p_proposal: room,
              p_blocked: true,
            })
          ).error?.code,
          "42501",
        );
        assert.equal(
          (
            await client.rpc("conversation_report", {
              p_message: randomUUID(),
              p_reason: "Fictional private report reason",
            })
          ).error?.code,
          "42501",
        );
      }
      assert.equal(
        sql(
          "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_messaging' and c.relkind='r' and c.relrowsecurity;",
        ),
        "2",
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_messaging.reports','select');`,
          ),
          "f",
        );
    },
  );
  await check(
    "12 concurrent retries create exactly one message and charge quota only once; key reuse conflicts",
    async () => {
      retryKey = randomUUID();
      const responses = await Promise.all(
        Array.from({ length: 12 }, () => send(brand, retryKey)),
      );
      assert.ok(
        responses.every((r) => !r.error),
        JSON.stringify(responses.find((r) => r.error)?.error),
      );
      assert.equal(new Set(responses.map((r) => r.data)).size, 1);
      firstId = responses[0].data;
      assert.equal(
        sql(
          `select count(*) from public.messages where proposal_id='${room}';`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select sum(used) from adme_ops.rate_windows where subject='${ids.brand}' and scope='message_day';`,
        ),
        "1",
      );
      assert.equal(
        (await send(brand, retryKey, { p_body: "changed payload" })).error
          ?.code,
        "23505",
      );
      const second = await send(creator, retryKey);
      assert.equal(second.error, null);
      assert.notEqual(second.data, firstId);
    },
  );
  await check(
    "stable cursor covers equal-microsecond timestamps without duplicates and omits retry keys",
    async () => {
      sql(
        `insert into public.messages(proposal_id,sender_id,body,kind,created_at) select '${room}','${ids.creator}','FICTIONAL history '||n,'message','2000-01-01T00:00:00.123456Z' from generate_series(1,25) n;`,
      );
      const found = [],
        expected = sql(
          `select string_agg(id::text,',' order by created_at desc,id desc) from public.messages where proposal_id='${room}';`,
        ).split(",");
      let cursor = {};
      for (let i = 0; i < 8; i++) {
        const r = await page(brand, { p_limit: 5, ...cursor });
        assert.equal(r.error, null);
        for (const m of r.data.items) {
          assert.equal("idempotency_key" in m, false);
          found.push(m.id);
        }
        if (!r.data.nextCursor) break;
        cursor = {
          p_before_at: r.data.nextCursor.createdAt,
          p_before_id: r.data.nextCursor.id,
        };
      }
      assert.deepEqual(found, expected);
      assert.equal(new Set(found).size, 27);
      for (const extra of [
        { p_limit: 51 },
        { p_limit: 0 },
        { p_before_id: randomUUID() },
      ])
        assert.equal((await page(brand, extra)).error?.code, "22023");
    },
  );
  await check(
    "blocking retains history and denies both RPC and old direct inserts; only actor unblocks own choice",
    async () => {
      assert.equal(
        (
          await brand.rpc("conversation_block", {
            p_proposal: room,
            p_blocked: true,
          })
        ).error,
        null,
      );
      assert.equal((await send(creator)).error?.code, "42501");
      assert.equal(
        (
          await brand.from("messages").insert({
            proposal_id: room,
            sender_id: ids.brand,
            body: "direct blocked",
            kind: "message",
          })
        ).error?.code,
        "42501",
      );
      assert.equal((await page(creator)).data.blocked, true);
      assert.equal((await send(brand, retryKey)).data, firstId); // Acknowledges earlier write, never creates another.
      await creator.rpc("conversation_block", {
        p_proposal: room,
        p_blocked: false,
      });
      assert.equal((await page(creator)).data.blocked, true);
      await brand.rpc("conversation_block", {
        p_proposal: room,
        p_blocked: false,
      });
      assert.equal((await page(creator)).data.blocked, false);
      assert.equal(
        (
          await brand.rpc("chat_control", {
            p_id: room,
            p_action: "block",
            p_reason: "",
          })
        ).error,
        null,
      );
      assert.equal((await page(creator)).data.blocked, true);
      assert.equal((await send(creator)).error?.code, "42501");
      assert.equal(
        (
          await creator.rpc("chat_control", {
            p_id: room,
            p_action: "unblock",
            p_reason: "",
          })
        ).error,
        null,
      );
      assert.equal((await page(creator)).data.blocked, true);
      assert.equal(
        (
          await brand.rpc("chat_control", {
            p_id: room,
            p_action: "unblock",
            p_reason: "",
          })
        ).error,
        null,
      );
      assert.equal((await page(creator)).data.blocked, false);
    },
  );
  await check(
    "reports are private, participant-only, non-self, deduplicated and DB-limited to five per hour",
    async () => {
      assert.equal(
        (
          await brand.rpc("conversation_report", {
            p_message: firstId,
            p_reason: "Fictional private report",
          })
        ).error?.code,
        "42501",
      );
      const args = { p_message: firstId, p_reason: "Fictional private report" };
      const a = await creator.rpc("conversation_report", args),
        b = await creator.rpc("conversation_report", args);
      assert.equal(a.error, null);
      assert.equal(a.data, b.data);
      const messages = sql(
        `select id from public.messages where proposal_id='${room}' and sender_id='${ids.creator}' order by id limit 6;`,
      ).split("\n");
      for (const id of messages.slice(0, 5))
        assert.equal(
          (await brand.rpc("conversation_report", { ...args, p_message: id }))
            .error,
          null,
        );
      assert.equal(
        (
          await brand.rpc("conversation_report", {
            ...args,
            p_message: messages[5],
          })
        ).error?.code,
        "PT429",
      );
      assert.equal(
        sql(
          `select count(*) from adme_messaging.reports where reporter_id='${ids.brand}';`,
        ),
        "5",
      );
    },
  );
  await check(
    "direct and RPC writes preserve role/status/HTTPS/moderation gates and old valid INSERT compatibility",
    async () => {
      assert.equal(
        (
          await send(brand, randomUUID(), {
            p_kind: "deliverable",
            p_url: "https://example.org/result",
          })
        ).error?.code,
        "42501",
      );
      assert.equal(
        (
          await send(creator, randomUUID(), {
            p_kind: "deliverable",
            p_url: "https://example.org/result",
          })
        ).error,
        null,
      );
      assert.equal((await send(creator, null)).error?.code, "22023");
      assert.equal(
        (
          await send(creator, randomUUID(), {
            p_url: "https://user:secret@example.org/file",
          })
        ).error?.code,
        "22023",
      );
      sql(
        `update public.creators set moderation_status='restricted' where id='${creatorId}';`,
      );
      assert.equal((await send(creator)).error?.code, "42501");
      sql(
        `update public.creators set moderation_status='allowed' where id='${creatorId}';`,
      );
      assert.equal(
        (
          await brand.from("messages").insert({
            proposal_id: room,
            sender_id: ids.brand,
            body: "legacy valid insert",
            kind: "message",
          })
        ).error,
        null,
      );
      assert.equal(
        (
          await other.from("messages").insert({
            proposal_id: room,
            sender_id: ids.brand,
            body: "forged sender",
            kind: "message",
          })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "25 new concurrent sends admit exactly20; full-quota retry returns previous id",
    async () => {
      clearSend();
      const keys = Array.from({ length: 25 }, () => randomUUID());
      const r = await Promise.all(keys.map((key) => send(brand, key)));
      assert.equal(r.filter((x) => !x.error).length, 20);
      assert.equal(r.filter((x) => x.error?.code === "PT429").length, 5);
      const index = r.findIndex((x) => !x.error);
      assert.equal((await send(brand, keys[index])).data, r[index].data);
      assert.equal((await send(creator)).error, null);
    },
  );
  await check(
    "public RPC wrappers are invoker and volatile; direct GET cannot bypass read quota",
    async () => {
      const r = await brand.rpc(
        "conversation_page",
        { p_proposal: room },
        { get: true },
      );
      assert.equal(r.status, 405);
      assert.equal(
        sql(
          "select count(*) from pg_proc where pronamespace='public'::regnamespace and proname like 'conversation_%' and not prosecdef and provolatile='v';",
        ),
        "3",
      );
      assert.equal(
        sql(
          "select prosecdef and proconfig @> array['search_path=\"\"'] from pg_proc where oid='public.conversation_block(uuid,boolean)'::regprocedure;",
        ),
        "t",
      );
      assert.equal(
        sql(
          "select has_function_privilege('authenticated','adme_messaging.block_room(uuid,boolean)','execute');",
        ),
        "f",
      );
    },
  );
} finally {
  cleanDeliveryFixtures([room]);
  sql(`delete from adme_messaging.reports where reporter_id in ('${ids.brand}','${ids.creator}'); delete from adme_messaging.blocks where proposal_id='${room}';
    delete from public.messages where proposal_id='${room}'; delete from public.proposals where id='${room}'; delete from public.campaigns where id='${campaign}'; delete from public.creators where id='${creatorId}';
    delete from adme_ops.rate_windows where subject in ('${ids.brand}','${ids.creator}','${ids.other}'); delete from auth.users where id in ('${ids.brand}','${ids.creator}','${ids.other}');`);
}
writeFileSync(
  "output/dev-a-db/conversation-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated actual PostgreSQL/PostgREST with fictional users only; no hosted/provider writes",
      results,
    },
    null,
    2,
  ),
);
