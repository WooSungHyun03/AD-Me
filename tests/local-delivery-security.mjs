import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import { cleanDeliveryFixtures } from "./support/delivery-fixture-cleanup.mjs";
localRuntime();
const ids = { brand: randomUUID(), creator: randomUUID(), other: randomUUID() },
  creatorId = `user-${ids.creator}`;
const rooms = Array.from({ length: 4 }, () => randomUUID()),
  campaigns = rooms.map(() => randomUUID());
const [room, legacy, blocked, paged] = rooms;
const brand = localClient(undefined, localJwt(ids.brand)),
  creator = localClient(undefined, localJwt(ids.creator)),
  other = localClient(undefined, localJwt(ids.other)),
  anon = localClient(),
  results = [];
const read = async (client = creator, id = room, extra = {}) => {
  const r = await client.rpc("delivery_page", {
    p_proposal: id,
    p_before: null,
    p_limit: 20,
    ...extra,
  });
  assert.equal(r.error, null);
  return r.data;
};
const create = (client, expected, key = randomUUID(), extra = {}, id = room) =>
  client.rpc("delivery_create", {
    p_proposal: id,
    p_expected: expected,
    p_key: key,
    p_body: "FICTIONAL immutable result body",
    p_url: "https://example.test/fictional-result",
    p_declaration: "marked",
    ...extra,
  });
const move = (
  client,
  id,
  submission,
  expected,
  action,
  key = randomUUID(),
  extra = {},
) =>
  client.rpc("delivery_transition", {
    p_proposal: id,
    p_submission: submission,
    p_expected: expected,
    p_key: key,
    p_action: action,
    p_note:
      action === "submitted" ? "" : "FICTIONAL review evidence and feedback",
    p_checked: action === "completed",
    ...extra,
  });
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
let first, second;
const uploadKey = randomUUID(),
  revisionKey = randomUUID(),
  approvalKey = randomUUID();
let current = 0;
try {
  for (const [name, uid] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${uid}','{"role":"${name === "creator" ? "creator" : "brand"}","name":"가상 결과물 QA"}');`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${ids.creator}',true,profile from public.creators where id='creator-001';`,
  );
  for (let i = 0; i < rooms.length; i++)
    sql(`insert into public.campaigns(id,owner_id,brief) select '${campaigns[i]}','${ids.brand}',brief from public.campaigns limit 1;
 insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief,status) values('${rooms[i]}','${campaigns[i]}','${creatorId}','${ids.brand}','${ids.creator}','proposal','Fictional versioned delivery QA','accepted');`);
  await check(
    "anon/foreign room access, forged roles, private tables and unmetered DTO execution are denied",
    async () => {
      for (const client of [anon, other]) {
        assert.equal(
          (await client.rpc("delivery_page", { p_proposal: room })).error?.code,
          "42501",
        );
        assert.equal((await create(client, 0)).error?.code, "42501");
      }
      assert.equal((await create(brand, 0)).error?.code, "42501");
      assert.equal(
        sql(
          "select count(*) from pg_class where relnamespace='adme_delivery'::regnamespace and relkind='r' and relrowsecurity;",
        ),
        "5",
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select count(*) from pg_class where relnamespace='adme_delivery'::regnamespace and relkind='r' and has_table_privilege('${role}',oid,'select');`,
          ),
          "0",
        );
      assert.equal(
        sql(
          "select has_function_privilege('authenticated','adme_delivery.dto(uuid)','execute');",
        ),
        "f",
      );
      const empty = await read();
      assert.equal(empty.canSubmit, false);
      assert.equal(empty.active, null);
      assert.equal(empty.enforced, true);
    },
  );
  await check(
    "12 concurrent same-key uploads create one snapshot, declaration and quota reservation",
    async () => {
      const r = await Promise.all(
        Array.from({ length: 12 }, () => create(creator, 0, uploadKey)),
      );
      assert.ok(
        r.every((x) => !x.error),
        JSON.stringify(r.find((x) => x.error)?.error),
      );
      assert.equal(new Set(r.map((x) => x.data)).size, 1);
      first = r[0].data;
      const p = await read();
      assert.equal(p.active.id, first);
      assert.equal(p.active.version, 1);
      assert.equal(p.active.attestation.declaration, "marked");
      current = p.roomRevision;
      assert.equal(current, 2);
      assert.equal(
        sql(
          `select count(*) from adme_delivery.submissions where proposal_id='${room}';`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select sum(used) from adme_ops.rate_windows where subject='${ids.creator}' and scope='delivery_create';`,
        ),
        "1",
      );
      assert.equal(
        (await create(creator, 0, uploadKey, { p_body: "different body" }))
          .error?.code,
        "23505",
      );
      assert.equal(
        (
          await create(creator, 0, uploadKey, {
            p_declaration: "not_applicable",
          })
        ).error?.code,
        "23505",
      );
      assert.equal((await create(creator, -1)).error?.code, "22023");
      assert.equal(
        (
          await create(creator, current, randomUUID(), {
            p_url: "https://user:secret@example.org/x",
          })
        ).error?.code,
        "22023",
      );
    },
  );
  await check(
    "versioned submit and duplicate revision requests preserve one review event; revised version cannot be resubmitted unchanged",
    async () => {
      assert.equal(
        (await move(brand, room, first, current, "submitted")).error?.code,
        "42501",
      );
      assert.equal(
        (await move(creator, room, first, current, "submitted")).error,
        null,
      );
      current = (await read()).roomRevision;
      assert.equal(current, 3);
      assert.equal(
        (await move(creator, room, first, current, "completed")).error?.code,
        "42501",
      );
      const r = await Promise.all(
        Array.from({ length: 8 }, () =>
          move(brand, room, first, current, "revision_requested", revisionKey, {
            p_checked: false,
          }),
        ),
      );
      assert.ok(r.every((x) => !x.error));
      assert.equal(new Set(r.map((x) => x.data.roomRevision)).size, 1);
      current = 4;
      assert.equal((await read()).needsNewVersion, true);
      assert.equal((await read()).canSubmit, false);
      assert.equal(
        (await move(creator, room, first, current, "submitted")).error?.code,
        "23514",
      );
      assert.equal(
        sql(
          `select count(*) from adme_delivery.events where proposal_id='${room}' and to_status='revision_requested';`,
        ),
        "1",
      );
    },
  );
  await check(
    "new snapshot replaces active version and stale first-version approval cannot finalize it",
    async () => {
      const r = await create(creator, current);
      assert.equal(r.error, null);
      second = r.data;
      let p = await read();
      assert.equal(p.active.version, 2);
      assert.equal(p.needsNewVersion, false);
      current = p.roomRevision;
      assert.equal(current, 6);
      assert.equal(
        (await move(creator, room, second, current, "submitted")).error,
        null,
      );
      current = (await read()).roomRevision;
      assert.equal(current, 7);
      assert.equal(
        (await move(brand, room, first, 3, "completed")).error?.code,
        "40001",
      );
      assert.equal(
        sql(`select status from public.proposals where id='${room}';`),
        "submitted",
      );
      assert.equal(
        (
          await brand.rpc("transition_proposal", {
            p_id: room,
            p_action: "completed",
          })
        ).error?.code,
        "40001",
      );
      await brand
        .from("proposals")
        .update({ status: "completed" })
        .eq("id", room);
      assert.equal(
        sql(`select status from public.proposals where id='${room}';`),
        "submitted",
      );
      assert.throws(
        () =>
          sql(
            `begin;set local role authenticated;insert into adme_delivery.events(proposal_id,submission_id,actor_id,request_key,expected_revision,from_status,to_status,note,advertising_checked) values('${room}','${second}','${ids.brand}','${randomUUID()}',7,'submitted','completed','FORGED event',true);rollback;`,
          ),
        /permission denied/,
      );
    },
  );
  await check(
    "approval requires grounds and explicit advertising check, concurrent retries finalize exactly once",
    async () => {
      assert.equal(
        (
          await move(brand, room, second, current, "completed", randomUUID(), {
            p_checked: false,
          })
        ).error?.code,
        "22023",
      );
      assert.equal(
        (
          await move(brand, room, second, current, "completed", randomUUID(), {
            p_note: " ",
          })
        ).error?.code,
        "22023",
      );
      const r = await Promise.all(
        Array.from({ length: 8 }, () =>
          move(brand, room, second, current, "completed", approvalKey),
        ),
      );
      assert.ok(r.every((x) => !x.error));
      assert.equal(new Set(r.map((x) => x.data.roomRevision)).size, 1);
      assert.equal(r[0].data.roomRevision, 8);
      assert.equal((await read()).status, "completed");
      assert.equal(
        sql(
          `select count(*) from adme_delivery.events where proposal_id='${room}' and to_status='completed' and actor_id='${ids.brand}';`,
        ),
        "1",
      );
      assert.equal(
        (await move(brand, room, second, 7, "completed", approvalKey)).data
          .roomRevision,
        8,
      );
      assert.equal(
        (
          await move(brand, room, second, 7, "completed", approvalKey, {
            p_note: "changed review evidence",
          })
        ).error?.code,
        "23505",
      );
    },
  );
  await check(
    "finalized snapshots/declarations/events are immutable and new uploads cannot change a completed room",
    async () => {
      const hash = () =>
        sql(
          `select md5(string_agg(to_jsonb(s)::text,',' order by version)) from adme_delivery.submissions s where proposal_id='${room}';`,
        );
      const before = hash();
      sql(
        `update public.messages set body='FICTIONAL changed legacy message source' where id='${second}';`,
      );
      assert.equal(hash(), before);
      for (const statement of [
        `update adme_delivery.submissions set body='tampered' where id='${second}';`,
        `delete from adme_delivery.attestations where submission_id='${second}';`,
        `delete from adme_delivery.events where proposal_id='${room}';`,
      ])
        assert.throws(() => sql(statement), /delivery history is immutable/);
      assert.equal((await create(creator, 8)).error?.code, "42501");
      assert.equal(
        (await move(brand, room, second, 8, "revision_requested")).error?.code,
        "40001",
      );
      assert.equal((await read()).legacyCompleted, false);
    },
  );
  await check(
    "legacy raw deliveries are captured but cannot submit/approve unchecked; explicit declaration adopts the room",
    async () => {
      const raw = await creator.rpc("conversation_send", {
        p_proposal: legacy,
        p_key: randomUUID(),
        p_body: "FICTIONAL legacy raw delivery",
        p_kind: "deliverable",
        p_url: "https://example.test/legacy-delivery",
      });
      assert.equal(raw.error, null);
      let p = await read(creator, legacy);
      assert.equal(p.active.attestation, null);
      assert.equal(p.canAttest, true);
      assert.equal(p.canSubmit, false);
      assert.equal(
        (await move(creator, legacy, raw.data, p.roomRevision, "submitted"))
          .error?.code,
        "23514",
      );
      assert.equal(
        (
          await creator.rpc("transition_proposal", {
            p_id: legacy,
            p_action: "submitted",
          })
        ).error?.code,
        "40001",
      );
      assert.equal(
        (
          await creator.rpc("delivery_attest", {
            p_proposal: legacy,
            p_submission: raw.data,
            p_expected: p.roomRevision,
            p_declaration: "not_applicable",
          })
        ).error,
        null,
      );
      p = await read(creator, legacy);
      assert.equal(p.canSubmit, true);
      assert.equal(
        (
          await creator.rpc("delivery_attest", {
            p_proposal: legacy,
            p_submission: raw.data,
            p_expected: 1,
            p_declaration: "not_applicable",
          })
        ).data,
        true,
      );
      assert.equal(
        (
          await creator.rpc("delivery_attest", {
            p_proposal: legacy,
            p_submission: raw.data,
            p_expected: p.roomRevision,
            p_declaration: "marked",
          })
        ).error?.code,
        "23505",
      );
    },
  );
  await check(
    "blocked/moderated conversations deny new version mutations while retaining participant history",
    async () => {
      const r = await create(creator, 0, randomUUID(), {}, blocked);
      assert.equal(r.error, null);
      const p = await read(creator, blocked);
      await brand.rpc("conversation_block", {
        p_proposal: blocked,
        p_blocked: true,
      });
      assert.equal(
        (await create(creator, p.roomRevision, randomUUID(), {}, blocked)).error
          ?.code,
        "42501",
      );
      assert.equal(
        (await move(creator, blocked, r.data, p.roomRevision, "submitted"))
          .error?.code,
        "42501",
      );
      assert.equal((await read(creator, blocked)).canCreate, false);
      await brand.rpc("conversation_block", {
        p_proposal: blocked,
        p_blocked: false,
      });
      sql(
        `update public.creators set moderation_status='restricted' where id='${creatorId}';`,
      );
      assert.equal(
        (await create(creator, p.roomRevision, randomUUID(), {}, blocked)).error
          ?.code,
        "42501",
      );
      sql(
        `update public.creators set moderation_status='allowed' where id='${creatorId}';`,
      );
    },
  );
  await check(
    "bounded version cursor has no gaps/duplicates even for equal submission timestamps",
    async () => {
      sql(
        `insert into public.messages(proposal_id,sender_id,body,kind,url,created_at) select '${paged}','${ids.creator}','FICTIONAL history version '||n,'deliverable','https://example.test/history/'||n,'2000-01-01T00:00:00.123456Z' from generate_series(1,25) n;`,
      );
      const found = [];
      let before = null;
      for (let i = 0; i < 6; i++) {
        const p = await read(creator, paged, { p_limit: 5, p_before: before });
        found.push(...p.items.map((x) => x.version));
        if (!p.nextVersion) break;
        before = p.nextVersion;
      }
      assert.deepEqual(
        found,
        Array.from({ length: 25 }, (_, i) => 25 - i),
      );
      for (const args of [{ p_limit: 51 }, { p_limit: 0 }, { p_before: 0 }])
        assert.equal(
          (await creator.rpc("delivery_page", { p_proposal: paged, ...args }))
            .error?.code,
          "22023",
        );
      assert.equal(
        (
          await creator.rpc(
            "delivery_page",
            { p_proposal: paged },
            { get: true },
          )
        ).status,
        405,
      );
    },
  );
  await check(
    "boundary cannot reopen and activation is owner-only with first-release evidence preserved",
    async () => {
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_delivery.activate(text)','execute');`,
          ),
          "f",
        );
      assert.throws(
        () => sql("update adme_delivery.boundary set enabled=false;"),
        /cannot be reopened/,
      );
      assert.throws(
        () => sql("delete from adme_delivery.boundary;"),
        /cannot be reopened/,
      );
      sql(
        "select adme_delivery.activate('1111111111111111111111111111111111111111');",
      );
      const evidence = sql(
        "select release_ref||activated_at::text from adme_delivery.boundary;",
      );
      sql(
        "select adme_delivery.activate('2222222222222222222222222222222222222222');",
      );
      assert.equal(
        sql(
          "select release_ref||activated_at::text from adme_delivery.boundary;",
        ),
        evidence,
      );
    },
  );
} finally {
  cleanDeliveryFixtures(rooms);
  const list = rooms.map((x) => `'${x}'`).join(",");
  sql(
    `delete from adme_messaging.blocks where proposal_id in(${list});delete from public.audit_log where entity_id in(${list});delete from public.messages where proposal_id in(${list});delete from public.proposals where id in(${list});delete from public.campaigns where id in(${campaigns.map((x) => `'${x}'`).join(",")});delete from public.creators where id='${creatorId}';delete from adme_ops.rate_windows where subject in('${ids.brand}','${ids.creator}','${ids.other}');delete from auth.users where id in('${ids.brand}','${ids.creator}','${ids.other}');`,
  );
}
writeFileSync(
  "output/dev-a-db/delivery-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "actual isolated SQL/PostgREST, fictional users/results/declarations only; no provider/legal verification or hosted writes",
      results,
    },
    null,
    2,
  ),
);
