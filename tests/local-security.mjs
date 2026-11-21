import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import {
  publicationArgs,
  creatorPublicationData,
} from "./support/publication-fixture.mjs";
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
    assert.equal(
      (await anonymous.from("creators").select("profile")).error?.code,
      "42501",
    );
    const { data: fixture } = await adminFresh
      .from("creators")
      .select("profile")
      .eq("id", "creator-001")
      .single();
    const fixtureOwner = randomUUID();
    const id = `user-${fixtureOwner}`;
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${fixtureOwner}','{"role":"creator","name":"QA isolated lock fixture"}');`,
    );
    const fixtureCreator = localClient(undefined, localJwt(fixtureOwner));
    try {
      assert.equal(
        (
          await fixtureCreator.rpc(
            "save_publication",
            publicationArgs(
              "creator",
              creatorPublicationData({
                ...fixture.profile,
                name: "QA isolated fixture",
                published: true,
              }),
            ),
          )
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
        (await anonymous.from("creators").select("id").eq("id", id)).error
          ?.code,
        "42501",
      );
      const publicRows = await anonymous.rpc("creator_catalog_page", {
        p_after: "",
        p_limit: 200,
      });
      assert.equal(publicRows.error, null);
      assert.equal(
        publicRows.data.items.some((row) => row.seed_id === id),
        false,
      );
      assert.equal(
        (
          await fixtureCreator
            .from("creators")
            .update({ published: true })
            .eq("id", id)
        ).error,
        null,
      );
      assert.equal(
        (await anonymous.from("creators").select("id").eq("id", id)).error
          ?.code,
        "42501",
      );
      const afterRepublish = await anonymous.rpc("creator_catalog_page", {
        p_after: "",
        p_limit: 200,
      });
      assert.equal(afterRepublish.error, null);
      assert.equal(
        afterRepublish.data.items.some((row) => row.seed_id === id),
        false,
      );
      assert.equal(
        (
          await fixtureCreator
            .from("creators")
            .update({ moderation_status: "allowed" })
            .eq("id", id)
        ).error?.code,
        "42501",
      );
      assert.equal(
        (await fixtureCreator.from("creators").delete().eq("id", id)).error
          ?.code,
        "42501",
      );
      assert.equal(
        (
          await fixtureCreator
            .from("creators")
            .update({ published: false })
            .eq("id", id)
        ).error,
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
        (await anonymous.from("creators").select("id").eq("id", id)).error
          ?.code,
        "42501",
      );
      const afterRelease = await anonymous.rpc("creator_catalog_page", {
        p_after: "",
        p_limit: 200,
      });
      assert.equal(afterRelease.error, null);
      assert.equal(
        afterRelease.data.items.some((row) => row.seed_id === id),
        false,
        "release does not republish owner-hidden content",
      );
      assert.equal(
        (await fixtureCreator.from("creators").delete().eq("id", id)).error,
        null,
      );
    } finally {
      sql(
        `delete from public.creators where owner_id='${fixtureOwner}'; delete from auth.users where id='${fixtureOwner}';`,
      );
    }
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
  "output/dev-a-db/local-security.local.json",
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
