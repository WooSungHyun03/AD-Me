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
const brand = localClient(undefined, localJwt(a.brand.id));
const other = localClient(undefined, localJwt(a.other.id));
const id = randomUUID();
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
try {
  sql(
    `insert into adme_ops.jobs(id,kind,owner_id,input) values('${id}','marketing_draft','${a.brand.id}','Isolated read-quota fixture');`,
  );
  await check(
    "direct draft getter preserves owner isolation and anonymous denial",
    async () => {
      assert.equal(
        (await brand.rpc("ops_draft_get", { p_id: id })).data.status,
        "queued",
      );
      assert.equal((await other.rpc("ops_draft_get", { p_id: id })).data, null);
      assert.equal(
        (await localClient().rpc("ops_draft_get", { p_id: id })).error?.code,
        "42501",
      );
    },
  );
  await check(
    "direct RPC admits120 of125 concurrent reads with429 and bounded exact retry",
    async () => {
      const left = 60 - ((Date.now() / 1000) % 60);
      if (left < 4)
        await new Promise((resolve) =>
          setTimeout(resolve, (left + 0.1) * 1000),
        );
      sql(`delete from adme_ops.rate_windows where scope='draft_read';`);
      const calls = await Promise.all(
        Array.from({ length: 125 }, () =>
          brand.rpc("ops_draft_get", { p_id: id }),
        ),
      );
      assert.equal(calls.filter((r) => !r.error).length, 120);
      assert.ok(
        calls
          .filter((r) => r.error)
          .every(
            (r) =>
              r.status === 429 &&
              r.error.code === "PT429" &&
              JSON.parse(r.error.details).retryAfter >= 1,
          ),
      );
      assert.equal(
        (await other.rpc("ops_draft_get", { p_id: id })).error,
        null,
      );
      const get = await brand.rpc("ops_draft_get", { p_id: id }, { get: true });
      assert.ok(get.error);
      assert.equal(get.data, null);
    },
  );
  await check(
    "legacy optional quota cannot bypass or double-charge the getter and recovery is account-local",
    async () => {
      sql(
        "delete from adme_ops.rate_windows where scope in ('draft_read','draft_poll');",
      );
      assert.equal(
        (await brand.rpc("ops_request_quota", { p_action: "draft_poll" })).data
          .allowed,
        true,
      );
      assert.equal(
        (await brand.rpc("ops_draft_get", { p_id: id })).data.status,
        "queued",
      );
      assert.equal(
        sql(
          `select used from adme_ops.rate_windows where scope='draft_read' and subject='${a.brand.id}';`,
        ),
        "1",
      );
      assert.equal(
        sql(
          `select used from adme_ops.rate_windows where scope='draft_poll' and subject='${a.brand.id}';`,
        ),
        "1",
      );
    },
  );
} finally {
  sql(
    `delete from adme_ops.jobs where id='${id}'; delete from adme_ops.rate_windows where scope in ('draft_read','draft_poll') and subject in ('${a.brand.id}','${a.other.id}');`,
  );
}
writeFileSync(
  "output/dev-a-db/draft-read-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope: "isolated local Auth JWT contracts; no provider",
      results,
    },
    null,
    2,
  ),
);
