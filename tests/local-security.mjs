import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localClient,
  localJwt,
  localRuntime,
  sql,
} from "./support/local-qa.mjs";

localRuntime(); // Fail before touching any service if the runtime is not isolated.
const accounts = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const results = [];
async function check(name, run) {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
const anonymous = localClient();
const brand = localClient();
const creator = localClient();
const admin = localClient();
for (const [client, role] of [
  [brand, "brand"],
  [creator, "creator"],
  [admin, "admin"],
])
  assert.equal(
    (await client.auth.signInWithPassword(accounts[role])).error,
    null,
  );
const adminFresh = localClient(undefined, localJwt(accounts.admin.id));
const now = Math.floor(Date.now() / 1000);
await check(
  "role-only AAL1 administrator cannot read private reports or invoke moderation",
  async () => {
    assert.equal((await admin.rpc("is_admin")).data, false);
    assert.equal((await admin.from("reports").select("*")).data.length, 0);
    assert.equal(
      (
        await admin.rpc("moderate_entity", {
          p_kind: "creator",
          p_id: "creator-001",
          p_published: false,
          p_reason: "QA local denial",
        })
      ).error?.code,
      "42501",
    );
  },
);
await check(
  "anonymous and regular accounts cannot provision or self-grant administration",
  async () => {
    for (const client of [anonymous, brand]) {
      assert.ok(
        (
          await client.rpc("provision_administrator", {
            p_user: accounts.brand.id,
            p_approval_reference: "forged approval",
            p_expires_at: new Date(Date.now() + 3600000).toISOString(),
          })
        ).error,
      );
      assert.ok((await client.from("administrator_grants").select("*")).error);
    }
    assert.ok(
      (
        await brand
          .from("profiles")
          .update({ role: "admin" })
          .eq("id", accounts.brand.id)
      ).error,
    );
  },
);
await check(
  "stale, future, string-AMR and token-refresh-only JWTs fail through direct REST RPC",
  async () => {
    for (const amr of [
      [{ method: "totp", timestamp: now - 901 }],
      [{ method: "totp", timestamp: now + 60 }],
      ["totp"],
      [{ method: "password", timestamp: now }],
    ]) {
      const client = localClient(
        undefined,
        localJwt(accounts.admin.id, { amr }),
      );
      assert.equal((await client.rpc("is_admin")).data, false);
    }
  },
);
await check(
  "fresh MFA grants cannot update operator locks directly via REST",
  async () => {
    assert.equal((await adminFresh.rpc("is_admin")).data, true);
    assert.equal(
      (
        await adminFresh
          .from("creators")
          .update({ moderation_status: "restricted" })
          .eq("id", "creator-001")
      ).error?.code,
      "42501",
    );
  },
);
await check(
  "audited locks hide creators even after owner republish and deny delete/recreate",
  async () => {
    const { data: fixture } = await anonymous
      .from("creators")
      .select("profile")
      .eq("id", "creator-001")
      .single();
    const id = `user-${accounts.creator.id}`;
    assert.equal(
      (
        await creator
          .from("creators")
          .insert({
            id,
            owner_id: accounts.creator.id,
            published: true,
            profile: {
              ...fixture.profile,
              name: "QA isolated fixture",
              is_demo: false,
            },
          })
      ).error,
      null,
    );
    assert.equal(
      (
        await adminFresh.rpc("moderate_entity", {
          p_kind: "creator",
          p_id: id,
          p_published: false,
          p_reason: "QA isolated lock",
        })
      ).error,
      null,
    );
    assert.equal(
      (await anonymous.from("creators").select("id").eq("id", id)).data.length,
      0,
    );
    assert.equal(
      (await creator.from("creators").update({ published: true }).eq("id", id))
        .error,
      null,
    );
    assert.equal(
      (await anonymous.from("creators").select("id").eq("id", id)).data.length,
      0,
    );
    assert.equal(
      (
        await creator
          .from("creators")
          .update({ moderation_status: "allowed" })
          .eq("id", id)
      ).error?.code,
      "42501",
    );
    assert.equal(
      (await creator.from("creators").delete().eq("id", id)).error?.code,
      "42501",
    );
    assert.equal(
      (await creator.from("creators").update({ published: false }).eq("id", id))
        .error,
      null,
    );
    assert.equal(
      (
        await adminFresh.rpc("moderate_entity", {
          p_kind: "creator",
          p_id: id,
          p_published: true,
          p_reason: "QA local release",
        })
      ).error,
      null,
    );
    assert.equal(
      (await anonymous.from("creators").select("id").eq("id", id)).data.length,
      0,
      "release does not republish owner-hidden content",
    );
    assert.equal(
      (await creator.from("creators").delete().eq("id", id)).error,
      null,
    );
  },
);
await check(
  "revoked grant blocks an otherwise fresh JWT immediately",
  async () => {
    sql(`select public.revoke_administrator('${accounts.admin.id}');`);
    assert.equal((await adminFresh.rpc("is_admin")).data, false);
    assert.equal(
      (
        await adminFresh.rpc("moderate_entity", {
          p_kind: "creator",
          p_id: "creator-001",
          p_published: false,
          p_reason: "QA revoked denial",
        })
      ).error?.code,
      "42501",
    );
    sql(
      `select public.provision_administrator('${accounts.admin.id}', 'LOCAL QA fixture restoration', now()+interval '1 day');`,
    );
  },
);
await check(
  "operator history is append-only and denied to ordinary accounts",
  async () => {
    assert.equal(
      (await brand.from("moderation_events").select("*")).data.length,
      0,
    );
    assert.ok(
      (
        await adminFresh
          .from("moderation_events")
          .update({ reason: "tampered" })
          .gte("id", 0)
      ).error,
    );
    const before = await adminFresh.from("audit_log").select("id").order("id");
    const deletion = await adminFresh
      .from("audit_log")
      .delete()
      .gte("id", 0)
      .select("id");
    assert.equal(deletion.data?.length ?? 0, 0);
    assert.deepEqual(
      (await adminFresh.from("audit_log").select("id").order("id")).data,
      before.data,
    );
  },
);
writeFileSync(
  "harness/evidence/DEV-A-P0-CONTINUE/local-security.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      environment: "isolated Docker Supabase, fictional accounts",
      results,
      jwt_note:
        "Stale/fresh AMR REST cases use synthetic locally signed JWTs; no cloud MFA/provider verification claimed. prepare-local-qa also verifies a real TOTP against local Auth.",
    },
    null,
    2,
  ),
);
