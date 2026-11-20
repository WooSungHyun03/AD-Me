import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";
const runtime = localRuntime();
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const brand = localClient(undefined, localJwt(accounts.brand.id));
const other = localClient(undefined, localJwt(accounts.other.id));
const worker = localClient();
const token = randomBytes(32).toString("hex");
const campaign = randomUUID(),
  proposal = randomUUID(),
  creator = `rate-fixture-${randomUUID()}`;
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
function clear(scope) {
  sql(`delete from adme_ops.rate_windows where scope='${scope}';`);
}
try {
  sql(`insert into public.creators(id,published,profile) select '${creator}',true,profile from public.creators limit 1;
    insert into public.campaigns(id,owner_id,brief) select '${campaign}','${accounts.brand.id}',brief from public.campaigns limit 1;
    insert into public.proposals(id,campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values('${proposal}','${campaign}','${creator}','${accounts.brand.id}','${accounts.creator.id}','proposal','Local fictional rate fixture');
    update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8')) where singleton=true;`);
  await check(
    "message and deliverable policies distinguish participants, kind and accepted state",
    async () => {
      const actor = localClient(undefined, localJwt(accounts.creator.id));
      const send = (c, id, kind) =>
        c
          .from("messages")
          .insert({
            proposal_id: proposal,
            sender_id: id,
            body: "Local message policy fixture",
            kind,
            url: kind === "deliverable" ? "https://example.test/result" : null,
          });
      assert.equal(
        (await send(brand, accounts.brand.id, "message")).error,
        null,
      );
      assert.equal(
        (await send(actor, accounts.creator.id, "message")).error,
        null,
      );
      assert.equal(
        (await send(actor, accounts.creator.id, "deliverable")).error?.code,
        "42501",
      );
      sql(
        `update public.proposals set status='accepted' where id='${proposal}';`,
      );
      assert.equal(
        (await send(brand, accounts.brand.id, "deliverable")).error?.code,
        "42501",
      );
      assert.equal(
        (await send(actor, accounts.creator.id, "deliverable")).error,
        null,
      );
      sql(
        `update public.proposals set status='rejected' where id='${proposal}';`,
      );
      assert.equal(
        (await send(brand, accounts.brand.id, "message")).error?.code,
        "42501",
      );
      sql(
        `update public.proposals set status='pending' where id='${proposal}';`,
      );
    },
  );
  await check(
    "concurrent direct REST message inserts admit exactly20 and preserve other-account access",
    async () => {
      clear("message_minute");
      clear("message_day");
      const responses = await Promise.all(
        Array.from({ length: 25 }, () =>
          brand
            .from("messages")
            .insert({
              proposal_id: proposal,
              sender_id: accounts.brand.id,
              body: "Local fixture",
              kind: "message",
            }),
        ),
      );
      assert.equal(
        responses.filter((r) => !r.error).length,
        20,
        JSON.stringify(responses[0].error),
      );
      const denied = responses.filter((r) => r.error);
      assert.equal(denied.length, 5);
      for (const r of denied) {
        assert.equal(r.status, 429);
        assert.equal(r.error.code, "PT429");
        const retry = JSON.parse(r.error.details).retryAfter;
        assert.ok(retry >= 1 && retry <= 60);
      }
      const raw = await fetch(`${runtime.API_URL}/rest/v1/messages`, {
        method: "POST",
        headers: {
          apikey: runtime.ANON_KEY,
          Authorization: `Bearer ${localJwt(accounts.brand.id)}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          proposal_id: proposal,
          sender_id: accounts.brand.id,
          body: "Header fixture",
          kind: "message",
        }),
      });
      assert.equal(raw.status, 429);
      assert.ok(Number(raw.headers.get("Retry-After")) >= 1);
      assert.equal(
        (
          await other
            .from("messages")
            .insert({
              proposal_id: proposal,
              sender_id: accounts.brand.id,
              body: "Impersonation",
              kind: "message",
            })
        ).error?.code,
        "42501",
      );
      clear("message_minute");
      assert.equal(
        (
          await brand
            .from("messages")
            .insert({
              proposal_id: proposal,
              sender_id: accounts.brand.id,
              body: "Recovered after local window reset",
              kind: "message",
            })
        ).error,
        null,
      );
      assert.equal(
        (
          await localClient(undefined, localJwt(accounts.creator.id))
            .from("messages")
            .insert({
              proposal_id: proposal,
              sender_id: accounts.creator.id,
              body: "Separate account unaffected",
              kind: "message",
            })
        ).error,
        null,
      );
    },
  );
  await check(
    "concurrent reports stop at five per account/hour and reject spoofed subjects",
    async () => {
      clear("report_hour");
      clear("report_day");
      const replies = await Promise.all(
        Array.from({ length: 8 }, () =>
          brand
            .from("reports")
            .insert({
              reporter_id: accounts.brand.id,
              creator_id: creator,
              reason: "Local fixture report, no real allegation",
              source_url: "https://example.test/evidence",
            }),
        ),
      );
      assert.equal(replies.filter((r) => !r.error).length, 5);
      assert.ok(
        replies
          .filter((r) => r.error)
          .every((r) => r.status === 429 && r.error.code === "PT429"),
      );
      assert.equal(
        (
          await other
            .from("reports")
            .insert({
              reporter_id: accounts.brand.id,
              creator_id: creator,
              reason: "Impersonation rejected",
              source_url: "https://example.test",
            })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "shared draft poll quota is atomic, private and account-isolated",
    async () => {
      clear("draft_poll");
      const replies = await Promise.all(
        Array.from({ length: 125 }, () =>
          brand.rpc("ops_request_quota", { p_action: "draft_poll" }),
        ),
      );
      assert.ok(replies.every((r) => !r.error));
      assert.equal(replies.filter((r) => r.data.allowed).length, 120);
      assert.ok(
        replies
          .filter((r) => !r.data.allowed)
          .every((r) => r.data.retryAfter >= 1 && r.data.retryAfter <= 60),
      );
      assert.equal(
        (await other.rpc("ops_request_quota", { p_action: "draft_poll" })).data
          .allowed,
        true,
      );
      assert.equal(
        (
          await localClient().rpc("ops_request_quota", {
            p_action: "draft_poll",
          })
        ).error?.code,
        "42501",
      );
      assert.equal(
        (
          await brand.rpc("ops_request_quota", {
            p_action: "arbitrary_subject",
          })
        ).error?.code,
        "22023",
      );
      assert.ok(
        (await brand.schema("adme_ops").from("rate_windows").select("*")).error,
      );
      clear("draft_poll");
      assert.equal(
        (await brand.rpc("ops_request_quota", { p_action: "draft_poll" })).data
          .allowed,
        true,
      );
    },
  );
  await check(
    "SQL fixed window expires naturally and denied reservations do not exceed the cap",
    async () => {
      // Sub-second test window waits at most1second inside SQL; no app timer or mocked clock.
      assert.equal(
        sql(
          `begin; select adme_ops.take_quota('expiry_fixture','local',1,1); select (adme_ops.take_quota('expiry_fixture','local',1,1)>0)::text; select pg_sleep(1.05); select adme_ops.take_quota('expiry_fixture','local',1,1); rollback;`,
        )
          .split(/\r?\n/)
          .filter(Boolean)
          .slice(-2, -1)[0],
        "0",
      );
    },
  );
  await check(
    "provider budget reservation precedes concurrent worker leases and a retry is charged again",
    async () => {
      sql(`delete from adme_ops.jobs; delete from adme_ops.rate_windows where scope='provider_day';
      select adme_ops.take_quota('provider_day','local_llm',30,86400,29);
      insert into adme_ops.jobs(kind,owner_id,input) values
      ('marketing_draft','${accounts.brand.id}','Local fictional budget draft one'),('marketing_draft','${accounts.other.id}','Local fictional budget draft two');`);
      const claims = await Promise.all(
        Array.from({ length: 6 }, () =>
          worker.rpc("ops_worker_claim", { p_token: token }),
        ),
      );
      assert.ok(claims.every((r) => !r.error));
      const leased = claims.filter((r) => r.data);
      assert.equal(leased.length, 1);
      const job = leased[0].data;
      assert.equal(
        sql(
          "select used from adme_ops.rate_windows where scope='provider_day' and subject='local_llm';",
        ),
        "30",
      );
      assert.equal(
        (
          await worker.rpc("ops_worker_finish", {
            p_token: token,
            p_id: job.id,
            p_lease: job.lease,
            p_result: null,
            p_error: "UPSTREAM_UNAVAILABLE",
            p_elapsed: 1,
          })
        ).data,
        true,
      );
      sql(`update adme_ops.jobs set available_at=now() where id='${job.id}';`);
      assert.equal(
        (await worker.rpc("ops_worker_claim", { p_token: token })).data,
        null,
      );
      assert.equal(
        sql(`select attempts from adme_ops.jobs where id='${job.id}';`),
        "1",
      );
      sql(
        "delete from adme_ops.rate_windows where scope='provider_day'; update adme_ops.jobs set available_at=now();",
      );
      const retry = await worker.rpc("ops_worker_claim", { p_token: token });
      assert.equal(retry.error, null);
      assert.ok(retry.data);
      assert.equal(
        sql(
          "select used from adme_ops.rate_windows where scope='provider_day' and subject='local_llm';",
        ),
        "1",
      );
    },
  );
  await check(
    "disabled resources reject direct RPC enqueue and do not lease previously queued work",
    async () => {
      sql(
        "delete from adme_ops.jobs; update adme_ops.resource_controls set ingestion_enabled=false,llm_enabled=false where singleton=true;",
      );
      assert.equal(
        (
          await brand.rpc("ops_draft_create", {
            p_input: "Local disabled feature fixture",
          })
        ).error?.code,
        "PT404",
      );
      assert.equal(
        (
          await localClient(undefined, localJwt(accounts.admin.id)).rpc(
            "ops_admin_command",
            {
              p_action: "discovery",
              p_value: "local fixture",
              p_extra: "true",
            },
          )
        ).error?.code,
        "PT404",
      );
      sql(
        "update adme_ops.resource_controls set llm_enabled=true where singleton=true;",
      );
      assert.equal(
        (
          await brand.rpc("ops_draft_create", {
            p_input: "Local queued before pause fixture",
          })
        ).error,
        null,
      );
      sql(
        "update adme_ops.resource_controls set llm_enabled=false where singleton=true;",
      );
      assert.equal(
        (await worker.rpc("ops_worker_claim", { p_token: token })).data,
        null,
      );
      sql(
        "delete from adme_ops.jobs; update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton=true;",
      );
    },
  );
  await check(
    "YouTube daily cost is conservatively reserved and cannot exceed1000 units/day",
    async () => {
      sql(
        "delete from adme_ops.jobs; delete from adme_ops.rate_windows where scope='provider_day'; select adme_ops.take_quota('provider_day','youtube',1000,86400,900); insert into adme_ops.jobs(kind,input) values('youtube_daily','local-budget-fixture');",
      );
      const denied = await worker.rpc("ops_worker_claim", { p_token: token });
      assert.equal(denied.error, null);
      assert.equal(denied.data, null);
      assert.equal(
        sql(
          "select used from adme_ops.rate_windows where scope='provider_day' and subject='youtube';",
        ),
        "900",
      );
      assert.equal(
        sql(
          "select error_code from adme_ops.jobs where input='local-budget-fixture';",
        ),
        "LOCAL_BUDGET",
      );
    },
  );
} finally {
  sql(
    `delete from public.messages where proposal_id='${proposal}'; delete from public.reports where creator_id='${creator}'; delete from public.proposals where id='${proposal}'; delete from public.campaigns where id='${campaign}'; delete from public.creators where id='${creator}'; delete from adme_ops.jobs; delete from adme_ops.rate_windows; update adme_ops.settings set worker_hash=null where singleton=true; update adme_ops.resource_controls set ingestion_enabled=true,llm_enabled=true where singleton=true;`,
  );
}
writeFileSync(
  "output/dev-a-db/rate-security.local.json",
  JSON.stringify(
    {
      scope: "isolated local DB/API contracts; no provider calls",
      at: new Date().toISOString(),
      results,
    },
    null,
    2,
  ),
);
