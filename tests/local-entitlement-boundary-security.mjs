// Fictional loopback-only DB verification; no provider calls or hosted credentials.
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
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const admin = localClient(undefined, localJwt(accounts.admin.id));
const stale = localClient(
  undefined,
  localJwt(accounts.admin.id, { aal: "aal1", amr: [] }),
);
const owner = randomUUID();
const args = {
  p_owner: owner,
  p_sku: "brand_pro",
  p_days: 30,
  p_credits: 3,
  p_note: "fictional D001 QA grant",
};
const prior = sql("select row_to_json(b) from adme_release.billing_boundary b");
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
}
const count = () =>
  sql(`select count(*) from public.entitlements where owner_id='${owner}'`);
try {
  sql(
    `insert into auth.users(id,raw_user_meta_data)values('${owner}','{"role":"brand","name":"D001 fictional local QA"}');`,
  );
  await check(
    "billing OFF rejects fresh administrator direct RPC and identical retries without rows",
    async () => {
      sql("select adme_release.set_test_billing(false,'local-d001-qa-only')");
      for (let attempt = 0; attempt < 2; attempt++)
        assert.equal(
          (await admin.rpc("admin_grant_entitlement", args)).error?.code,
          "PT404",
        );
      assert.equal(count(), "0");
    },
  );
  let entitlement;
  await check(
    "billing ON preserves fresh administrator success and denies anon/brand/creator/stale MFA",
    async () => {
      sql("select adme_release.set_test_billing(true,'local-d001-qa-only')");
      for (const client of [
        localClient(),
        stale,
        ...["brand", "creator"].map((role) =>
          localClient(undefined, localJwt(accounts[role].id)),
        ),
      ])
        assert.equal(
          (await client.rpc("admin_grant_entitlement", args)).error?.code,
          "42501",
        );
      const result = await admin.rpc("admin_grant_entitlement", args);
      assert.equal(result.error, null);
      entitlement = result.data;
      assert.equal(count(), "1");
      assert.equal(
        sql(
          `select count(*) from public.credit_ledger where entitlement_id='${entitlement}' and kind='grant'`,
        ),
        "1",
      );
    },
  );
  await check(
    "switching OFF preserves historical rows, prevents new grants and retains recovery",
    async () => {
      sql("select adme_release.set_test_billing(false,'local-d001-qa-only')");
      assert.equal(
        (await admin.rpc("admin_grant_entitlement", args)).error?.code,
        "PT404",
      );
      assert.equal(count(), "1");
      const result = await admin.rpc("revoke_entitlement", {
        p_id: entitlement,
        p_reason: "fictional D001 QA recovery",
      });
      assert.equal(result.error, null);
      assert.equal(
        sql(
          `select credits=0 and revoked_at is not null from public.entitlements where id='${entitlement}'`,
        ),
        "t",
      );
      assert.equal(count(), "1");
    },
  );
  writeFileSync(
    "output/dev-a-db/d001-entitlement-boundary.local.json",
    JSON.stringify(
      { scope: "fictional loopback DB, no Toss provider", results },
      null,
      2,
    ),
  );
} finally {
  try {
    sql(
      `delete from public.credit_ledger where owner_id='${owner}'; delete from public.entitlements where owner_id='${owner}'; delete from auth.users where id='${owner}';`,
    );
  } finally {
    sql(
      `update adme_release.billing_boundary set (enabled,release_ref,changed_at)=(select enabled,release_ref,changed_at from json_populate_record(null::adme_release.billing_boundary,'${prior.replaceAll("'", "''")}')) where singleton;`,
    );
    assert.equal(
      sql("select row_to_json(b) from adme_release.billing_boundary b"),
      prior,
    );
  }
}
