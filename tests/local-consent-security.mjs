import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import {
  qaSignupConsent,
  enableLocalConsent,
} from "./support/consent-fixture.mjs";
const runtime = localRuntime(),
  admin = localClient(runtime.SERVICE_ROLE_KEY),
  anon = localClient(),
  created = [],
  results = [];
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const profile = JSON.parse(
  readFileSync("fixtures/creators.demo.json", "utf8"),
)[0];
let id, actor;
try {
  await check(
    "unapproved policy and missing individual acknowledgements are denied by actual GoTrue database trigger",
    async () => {
      sql("update adme_consent.policies set active=false;");
      const r = await anon.auth.signUp({
        email: `consent-${randomUUID()}@example.test`,
        password: randomBytes(24).toString("base64url"),
        options: {
          data: { role: "creator", name: "가상 동의 QA", ...qaSignupConsent },
        },
      });
      assert.ok(r.error);
      assert.equal(r.data.user, null);
      enableLocalConsent();
      const bad = { ...qaSignupConsent };
      delete bad.adult_beta_confirmed;
      const rejected = await admin.auth.admin.createUser({
        email: `consent-${randomUUID()}@example.test`,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { role: "creator", name: "가상 동의 QA", ...bad },
      });
      assert.ok(rejected.error);
    },
  );
  await check(
    "actual Auth signup records three server-timed purposes and metadata editing cannot rewrite them",
    async () => {
      const r = await admin.auth.admin.createUser({
        email: `consent-${randomUUID()}@example.test`,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: {
          role: "creator",
          name: "가상 동의 QA",
          ...qaSignupConsent,
          accepted_at: "2099-01-01T00:00:00Z",
        },
      });
      assert.equal(r.error, null);
      id = r.data.user.id;
      created.push(id);
      actor = localClient(undefined, localJwt(id));
      const history = await actor.rpc("my_consent_history");
      assert.equal(history.error, null);
      assert.equal(history.data.length, 3);
      assert.deepEqual(history.data.map((x) => x.purpose).sort(), [
        "adult_beta",
        "privacy",
        "terms",
      ]);
      for (const e of history.data) {
        assert.equal(e.accepted, true);
        assert.ok(Date.parse(e.recordedAt) <= Date.now() + 5000);
        assert.ok(!JSON.stringify(e).includes(id));
      }
      assert.equal(
        (
          await admin.auth.admin.updateUserById(id, {
            user_metadata: { terms_accepted: false },
          })
        ).error,
        null,
      );
      assert.deepEqual(
        (await actor.rpc("my_consent_history")).data,
        history.data,
      );
      assert.throws(() =>
        sql(
          `update adme_consent.events set accepted=false where actor_id='${id}';`,
        ),
      );
      assert.throws(() =>
        sql(`delete from adme_consent.events where actor_id='${id}';`),
      );
    },
  );
  await check(
    "own history is private, publication withdrawal is idempotent and immediately hides legacy plus normalized profiles",
    async () => {
      const legacy = "user-" + id,
        record = randomUUID(),
        identity = randomUUID();
      const p = {
        ...profile,
        name: "가상 동의 QA",
        is_demo: false,
        owner_consent: true,
        social_url: "https://www.youtube.com/watch?v=p0Fixture01",
      };
      sql(
        `insert into public.creators(id,owner_id,published,profile) values('${legacy}','${id}',true,'${JSON.stringify(p).replaceAll("'", "''")}');insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version,claim_status,owner_consent,publication_status) select '${identity}',id,'youtube','fictional-consent-${record}','가상 확인','https://www.youtube.com/watch?v=p0Fixture01',now(),'owner_submission','fictional-only','claimed',true,'published' from adme_creator.records where legacy_creator_id='${legacy}';`,
      );
      assert.equal((await anon.rpc("my_consent_history")).error?.code, "42501");
      assert.ok(
        (await actor.schema("adme_consent").from("events").select("*")).error,
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_consent.approve(text,text,text)','execute');`,
          ),
          "f",
        );
      const claimedChannel = "UC" + randomBytes(11).toString("hex");
      sql(
        `insert into adme_ops.channel_claims(channel_id,owner_id,verified_at,consent_at)values('${claimedChannel}','${id}',now(),now());`,
      );
      const args = {
        p_version: qaSignupConsent.policy_version,
        p_hash: qaSignupConsent.policy_hash,
        p_accept: false,
        p_key: randomUUID(),
      };
      const many = await Promise.all(
        Array.from({ length: 6 }, () =>
          actor.rpc("record_publication_consent", args),
        ),
      );
      for (const r of many) {
        assert.equal(r.error, null);
        assert.equal(r.data.accepted, false);
        assert.equal(r.data.id, many[0].data.id);
      }
      assert.equal(
        sql(
          `select count(*) from adme_consent.events where actor_id='${id}' and purpose='profile_publication';`,
        ),
        "1",
      );
      assert.equal(
        sql(`select published from public.creators where id='${legacy}';`),
        "f",
      );
      assert.equal(
        sql(
          `select consent_at is null from adme_ops.channel_claims where channel_id='${claimedChannel}' and owner_id='${id}';`,
        ),
        "t",
      );
      assert.equal(
        sql(
          `select owner_consent::text||':'||publication_status from adme_creator.identities where id='${identity}';`,
        ),
        "false:private",
      );
      assert.equal(
        (await anon.rpc("creator_public_one", { p_ref: legacy })).data,
        null,
      );
      const wrong = await actor.rpc("record_publication_consent", {
        ...args,
        p_accept: true,
      });
      assert.equal(wrong.error?.code, "22023");
      const other = randomUUID();
      sql(
        `insert into auth.users(id,raw_user_meta_data)values('${other}','{"role":"brand","name":"가상 타인"}');`,
      );
      created.push(other);
      assert.deepEqual(
        (
          await localClient(undefined, localJwt(other)).rpc(
            "my_consent_history",
          )
        ).data,
        [],
      );
    },
  );
  await check(
    "sensitive public text and inference metric boundaries agree in actual PostgreSQL and do not add private fields",
    async () => {
      for (const value of [
        "900101-1234567",
        "０１０－１２３４－５６７８",
        "person@example.test",
      ])
        assert.equal(
          sql(`select adme_creator.safe_public_text('${value}');`),
          "f",
        );
      for (const name of [
        "face_embedding",
        "health_status",
        "political_affiliation",
        "age_estimate",
      ])
        assert.equal(
          sql(`select adme_creator.safe_metric_name('${name}');`),
          "f",
        );
      assert.equal(
        sql("select adme_creator.safe_metric_name('engagement_rate');"),
        "t",
      );
      const legacy = "user-" + id;
      const bad = {
        ...profile,
        name: "가상 정보 경계",
        is_demo: false,
        bio: "person@example.test",
      };
      const r = await actor
        .from("creators")
        .update({ published: true, profile: bad })
        .eq("id", legacy);
      assert.equal(r.error?.code, "23514");
      assert.equal(
        sql(`select published from public.creators where id='${legacy}';`),
        "f",
      );
    },
  );
} finally {
  enableLocalConsent();
  for (const uid of created) {
    sql(
      `delete from public.creators where owner_id='${uid}';delete from adme_ops.rate_windows where subject='${uid}';`,
    );
    if (uid === id)
      assert.equal((await admin.auth.admin.deleteUser(uid)).error, null);
    else sql(`delete from auth.users where id='${uid}';`);
    assert.equal(
      sql(`select count(*) from adme_consent.events where actor_id='${uid}';`),
      "0",
    );
  }
}
writeFileSync(
  "output/dev-a-db/consent-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      results,
      scope:
        "Actual local GoTrue/PostgREST/PostgreSQL; fictional identities and policy approval. Synthetic locally signed role tokens for direct DB permission cases. No legal approval or external SMTP verification.",
    },
    null,
    2,
  ),
);
