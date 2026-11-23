// Isolated local direct REST checks. Synthetic JWTs verify DB contracts, not a hosted provider.
import assert from "node:assert/strict";
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
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
const now = Math.floor(Date.now() / 1000);
const client = (role, overrides) =>
  localClient(undefined, localJwt(accounts[role].id, overrides));
const command = (c, role, extra) =>
  c.rpc("ops_admin_command", {
    p_action: "staff",
    p_value: accounts[role].id,
    p_extra: extra,
  });
const admin = client("admin");
try {
  await check(
    "role-only admin, missing OTP, stale/future/refresh-only OTP deny operations through REST",
    async () => {
      for (const overrides of [
        { aal: "aal1" },
        { amr: [] },
        { amr: [{ method: "totp", timestamp: now - 901 }] },
        { amr: [{ method: "totp", timestamp: now + 60 }] },
        { amr: [{ method: "password", timestamp: now }] },
      ]) {
        const c = client("admin", overrides);
        assert.equal((await c.rpc("ops_enrollment_role")).data, "super");
        assert.equal((await c.rpc("ops_current_role")).data, null);
        assert.equal((await c.rpc("ops_dashboard")).error?.code, "42501");
        assert.equal(
          (await command(c, "other", "finance")).error?.code,
          "42501",
        );
      }
      sql(
        `update public.administrator_grants set revoked_at=now() where user_id='${accounts.admin.id}';`,
      );
      assert.equal((await admin.rpc("ops_current_role")).data, null);
      sql(
        `update public.administrator_grants set revoked_at=null where user_id='${accounts.admin.id}';`,
      );
    },
  );
  await check(
    "ordinary accounts cannot self-approve; legacy delegated roles require renewed approval",
    async () => {
      const other = client("other");
      assert.equal(
        (await command(other, "other", "super")).error?.code,
        "42501",
      );
      sql(
        `insert into adme_ops.staff(user_id,role) values('${accounts.other.id}','finance');`,
      );
      assert.equal((await other.rpc("ops_enrollment_role")).data, null);
      assert.equal((await other.rpc("ops_current_role")).data, null);
      assert.equal((await other.rpc("ops_dashboard")).error?.code, "42501");
    },
  );
  await check(
    "OTP-approved invitation expires in seven days and delegated finance cannot access members or grant roles",
    async () => {
      assert.equal((await command(admin, "other", "finance")).error, null);
      assert.equal(
        sql(
          `select (expires_at-approved_at=interval '7 days')::text from adme_ops.staff where user_id='${accounts.other.id}';`,
        ),
        "true",
      );
      const other = client("other");
      assert.equal((await other.rpc("ops_current_role")).data, "finance");
      const dashboard = await other.rpc("ops_dashboard");
      assert.equal(dashboard.error, null);
      assert.equal(dashboard.data.members, null);
      assert.equal(dashboard.data.channels, null);
      assert.ok(Array.isArray(dashboard.data.orders));
      assert.equal((await other.rpc("is_admin")).data, false);
      assert.equal(
        (await command(other, "brand", "content")).error?.code,
        "42501",
      );
      assert.equal(
        (await client("other", { aal: "aal1" }).rpc("ops_current_role")).data,
        null,
      );
      assert.equal(
        (await client("other", { aal: "aal1" }).rpc("ops_enrollment_role"))
          .data,
        "finance",
      );
    },
  );
  await check(
    "expired and removed delegated grants stop access on existing JWTs",
    async () => {
      const other = client("other");
      sql(
        `update adme_ops.staff set approved_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id='${accounts.other.id}';`,
      );
      assert.equal((await other.rpc("ops_enrollment_role")).data, null);
      assert.equal((await other.rpc("ops_dashboard")).error?.code, "42501");
      assert.equal((await command(admin, "other", "content")).error, null);
      assert.equal((await other.rpc("ops_current_role")).data, "content");
      assert.equal((await command(admin, "other", "remove")).error, null);
      assert.equal((await other.rpc("ops_current_role")).data, null);
    },
  );
  await check(
    "self-role changes, browser super grants and private-schema/table access remain denied",
    async () => {
      assert.equal(
        (await command(admin, "admin", "support")).error?.code,
        "42501",
      );
      assert.equal(
        (await command(admin, "other", "super")).error?.code,
        "42501",
      );
      for (const c of [localClient(), client("other"), admin]) {
        assert.ok((await c.schema("adme_ops").from("staff").select("*")).error);
        assert.ok(
          (
            await c.rpc("provision_staff", {
              p_user: accounts.other.id,
              p_role: "super",
              p_approval: "forged",
              p_expires: new Date(Date.now() + 3600000).toISOString(),
            })
          ).error,
        );
      }
      assert.equal(
        sql(
          "select bool_and(not prosecdef)::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'ops_%' and p.proname not in('ops_stats','ops_metrics');",
        ),
        "true",
      );
    },
  );
  await check(
    "current summary definers require provisioned recent-MFA admin or trusted service and public schema is not writable",
    async () => {
      for (const c of [
        localClient(),
        client("brand"),
        client("creator"),
        client("admin", { aal: "aal1", amr: [] }),
      ]) {
        for (const name of ["ops_stats", "ops_metrics"])
          assert.ok((await c.rpc(name)).error, `${name} unauthorized`);
      }
      for (const name of ["ops_stats", "ops_metrics"]) {
        assert.equal(
          (await admin.rpc(name)).error,
          null,
          `${name} current admin`,
        );
        assert.equal(
          (await localClient(localRuntime().SERVICE_ROLE_KEY).rpc(name)).error,
          null,
          `${name} trusted service`,
        );
      }
      for (const role of ["anon", "authenticated"])
        assert.equal(
          sql(`select has_schema_privilege('${role}','public','create');`),
          "f",
        );
      sql(
        `update public.administrator_grants set revoked_at=now() where user_id='${accounts.admin.id}';`,
      );
      for (const name of ["ops_stats", "ops_metrics"])
        assert.ok((await admin.rpc(name)).error, `${name} revoked admin`);
    },
  );
} finally {
  sql(
    `delete from adme_ops.staff where user_id='${accounts.other.id}'; update public.administrator_grants set revoked_at=null where user_id='${accounts.admin.id}';`,
  );
}
writeFileSync(
  "output/dev-a-db/ops-security.local.json",
  JSON.stringify(
    { scope: "isolated local synthetic JWT authorization contracts", results },
    null,
    2,
  ),
);
