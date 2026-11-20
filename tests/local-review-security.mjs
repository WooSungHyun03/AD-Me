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
const ids = {
    reporter: randomUUID(),
    owner: randomUUID(),
    other: randomUUID(),
  },
  creatorId = `user-${ids.owner}`;
const reporter = localClient(undefined, localJwt(ids.reporter)),
  owner = localClient(undefined, localJwt(ids.owner)),
  other = localClient(undefined, localJwt(ids.other));
const admin = localClient(undefined, localJwt(accounts.admin.id)),
  stale = localClient(
    undefined,
    localJwt(accounts.admin.id, { aal: "aal1", amr: [] }),
  ),
  anon = localClient();
const policy = JSON.parse(
  sql("select to_jsonb(p)::text from adme_review.policy p;"),
);
const payload = {
  reason: "PRIVATE_ORIGINAL_CLAIM_FICTIONAL_ONLY",
  sourceUrl: "https://example.test/fictional-evidence",
  evidenceKind: "source",
};
const caseIds = [],
  results = [],
  key = randomUUID();
let caseId,
  version = 1;
const submit = (client, p_key = randomUUID(), p_payload = payload) =>
  client.rpc("review_submit", {
    p_kind: "issue",
    p_creator: creatorId,
    p_key,
    p_payload,
  });
const inbox = (client, extra = {}) =>
  client.rpc("review_inbox", { p_limit: 20, ...extra });
const publicRows = async () => {
  const r = await anon.rpc("public_review_records", {
    p_creator: creatorId,
    p_kind: "issue",
  });
  assert.equal(r.error, null);
  return r.data;
};
const decide = (client, extra = {}) =>
  client.rpc("review_decide", {
    p_id: caseId,
    p_expected: version,
    p_verdict: "approved",
    p_classification: "confirmed_fact",
    p_note: "INTERNAL_NOTE_FICTIONAL_ONLY",
    p_summary: "가상 자료의 운영 검토 공개 요약입니다.",
    p_publish: true,
    ...extra,
  });
const check = async (name, run) => {
  await run();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const fixtureHash = () =>
  sql(
    "select md5(string_agg(id||profile::text,',' order by id)) from public.creators where id like 'creator-%';",
  );
const before = fixtureHash();
try {
  for (const [role, uid] of Object.entries(ids))
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${uid}','{"role":"${role === "owner" ? "creator" : "brand"}","name":"가상 검토 QA"}');`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${ids.owner}',true,profile from public.creators where id='creator-001'; update adme_review.policy set enabled=false where singleton;`,
  );
  await check(
    "anonymous/private table grants/unknown payload/unsafe source are denied",
    async () => {
      assert.equal((await submit(anon)).error?.code, "42501");
      assert.equal((await inbox(anon)).error?.code, "42501");
      assert.equal(
        (await submit(reporter, randomUUID(), { ...payload, riskScore: 100 }))
          .error?.code,
        "22023",
      );
      assert.equal(
        (
          await submit(reporter, randomUUID(), {
            ...payload,
            sourceUrl: "https://user:secret@example.org/x",
          })
        ).error?.code,
        "22023",
      );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_review' and c.relkind='r' and has_table_privilege('${role}',c.oid,'select');`,
          ),
          "0",
        );
      assert.equal(
        sql(
          "select count(*) from pg_class c where c.relnamespace='adme_review'::regnamespace and c.relkind='r' and c.relrowsecurity;",
        ),
        "5",
      );
    },
  );
  await check(
    "eight concurrent retry submissions create one private case, revision and quota charge",
    async () => {
      const r = await Promise.all(
        Array.from({ length: 8 }, () => submit(reporter, key)),
      );
      assert.ok(
        r.every((x) => !x.error),
        JSON.stringify(r.find((x) => x.error)?.error),
      );
      assert.equal(new Set(r.map((x) => x.data)).size, 1);
      caseId = r[0].data;
      caseIds.push(caseId);
      assert.equal(
        sql(
          `select sum(used) from adme_ops.rate_windows where scope='review_submit_day' and subject='${ids.reporter}';`,
        ),
        "1",
      );
      assert.equal(
        (
          await submit(reporter, key, {
            ...payload,
            reason: "A different fictional assertion",
          })
        ).error?.code,
        "23505",
      );
      assert.deepEqual(await publicRows(), []);
      assert.equal((await inbox(owner)).data.items[0].id, caseId);
      assert.deepEqual((await inbox(other)).data.items, []);
    },
  );
  await check(
    "concurrent correction has one winner; owner response creates a new version and stale review fails",
    async () => {
      const revise = (reason) =>
        reporter.rpc("review_revise", {
          p_id: caseId,
          p_expected: 1,
          p_payload: { ...payload, reason },
        });
      const r = await Promise.all([
        revise("FICTIONAL correction first version"),
        revise("FICTIONAL correction second version"),
      ]);
      assert.equal(r.filter((x) => !x.error).length, 1);
      assert.equal(r.find((x) => x.error).error.code, "40001");
      version = 2;
      assert.equal(
        (
          await other.rpc("review_revise", {
            p_id: caseId,
            p_expected: version,
            p_payload: payload,
          })
        ).error?.code,
        "42501",
      );
      const response = await owner.rpc("review_respond", {
        p_id: caseId,
        p_expected: version,
        p_body: "OWNER_PRIVATE_POSITION_FICTIONAL",
        p_source: null,
        p_public: false,
      });
      assert.equal(response.error, null);
      version = 3;
      assert.equal(
        (await decide(admin, { p_expected: 2 })).error?.code,
        "40001",
      );
      const c = (await inbox(reporter)).data.items[0];
      assert.equal(c.history[0].payload.reason, payload.reason);
      assert.equal(c.history.length, 3);
      assert.equal(c.responses[0].version, 3);
    },
  );
  await check(
    "ordinary/stale MFA/self review and unapproved publication are denied without changing pending state",
    async () => {
      for (const client of [reporter, stale])
        assert.equal((await decide(client)).error?.code, "42501");
      assert.equal((await decide(admin)).error?.code, "23514");
      const self = await submit(admin);
      assert.equal(self.error, null);
      caseIds.push(self.data);
      assert.equal(
        (
          await decide(admin, {
            p_id: self.data,
            p_expected: 1,
            p_publish: false,
          })
        ).error?.code,
        "42501",
      );
      assert.equal((await inbox(reporter)).data.items[0].status, "pending");
    },
  );
  await check(
    "approved policy publishes only curated current facts; original allegations/internal notes/private position stay private",
    async () => {
      sql(
        "update adme_review.policy set enabled=true,version='fixture-policy-v1',approval_ref='https://example.test/fixture-policy' where singleton;",
      );
      assert.equal(
        (await decide(admin, { p_classification: "unverified_claim" })).error
          ?.code,
        "23514",
      );
      assert.equal((await decide(admin)).error, null);
      const rows = await publicRows();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].isDemo, true);
      for (const text of [
        payload.reason,
        "INTERNAL_NOTE_FICTIONAL_ONLY",
        "OWNER_PRIVATE_POSITION_FICTIONAL",
        ids.reporter,
        accounts.admin.id,
      ])
        assert.equal(JSON.stringify(rows).includes(text), false);
      assert.deepEqual(Object.keys(rows[0].payload).sort(), [
        "evidenceKind",
        "sourceUrl",
      ]);
      assert.equal(
        (await inbox(reporter)).data.items[0].decisions[0].note,
        null,
      );
      assert.equal(
        (await inbox(admin)).data.items.find((x) => x.id === caseId)
          .decisions[0].note,
        "INTERNAL_NOTE_FICTIONAL_ONLY",
      );
    },
  );
  await check(
    "policy disable/version change and creator publication/moderation hide previously approved records",
    async () => {
      sql("update adme_review.policy set enabled=false where singleton;");
      assert.deepEqual(await publicRows(), []);
      sql(
        "update adme_review.policy set enabled=true,version='fixture-policy-v2' where singleton;",
      );
      assert.deepEqual(await publicRows(), []);
      sql(
        "update adme_review.policy set version='fixture-policy-v1' where singleton;",
      );
      sql(
        `update public.creators set published=false where id='${creatorId}';`,
      );
      assert.deepEqual(await publicRows(), []);
      sql(
        `update public.creators set published=true,moderation_status='restricted' where id='${creatorId}';`,
      );
      assert.deepEqual(await publicRows(), []);
      sql(
        `update public.creators set moderation_status='allowed' where id='${creatorId}';`,
      );
      assert.equal((await publicRows()).length, 1);
    },
  );
  await check(
    "changed owner position hides approval immediately and must be reviewed at its new version",
    async () => {
      const r = await owner.rpc("review_respond", {
        p_id: caseId,
        p_expected: version,
        p_body: "가상 당사자가 공개에 동의한 새 입장입니다.",
        p_source: "https://example.test/fixture-position",
        p_public: true,
      });
      assert.equal(r.error, null);
      version = 4;
      assert.deepEqual(await publicRows(), []);
      assert.equal(
        (await decide(admin, { p_expected: 3 })).error?.code,
        "40001",
      );
      assert.equal((await decide(admin)).error, null);
      assert.equal(
        (await publicRows())[0].response.body,
        "가상 당사자가 공개에 동의한 새 입장입니다.",
      );
      const privateReply = await owner.rpc("review_respond", {
        p_id: caseId,
        p_expected: version,
        p_body: "최신 비공개 당사자 입장으로 변경한 가상 자료입니다.",
        p_source: null,
        p_public: false,
      });
      assert.equal(privateReply.error, null);
      version = 5;
      assert.deepEqual(await publicRows(), []);
      assert.equal((await decide(admin)).error, null);
      assert.equal((await publicRows())[0].response, null);
    },
  );
  await check(
    "revision/decision history is immutable; withdrawal hides current record and preserves audit without altering scores",
    async () => {
      assert.throws(() =>
        sql(
          `update adme_review.revisions set payload='{}' where case_id='${caseId}';`,
        ),
      );
      assert.throws(() =>
        sql(`delete from adme_review.decisions where case_id='${caseId}';`),
      );
      assert.equal(
        (
          await reporter.rpc("review_withdraw", {
            p_id: caseId,
            p_expected: version,
          })
        ).error,
        null,
      );
      assert.deepEqual(await publicRows(), []);
      assert.equal((await decide(admin)).error?.code, "40001");
      const auditCount = sql(
        `select count(*) from public.audit_log where entity_id='${caseId}';`,
      );
      for (let i = 0; i < 3; i++)
        assert.equal(
          (
            await reporter.rpc("review_withdraw", {
              p_id: caseId,
              p_expected: version,
            })
          ).data,
          true,
        );
      assert.equal(
        sql(
          `select count(*) from public.audit_log where entity_id='${caseId}';`,
        ),
        auditCount,
      );
      assert.equal(
        sql(
          `select sum(used) from adme_ops.rate_windows where subject='${ids.reporter}' and scope='review_withdraw';`,
        ),
        "1",
      );
      assert.ok(
        Number(
          sql(
            `select count(*) from public.audit_log where entity_id='${caseId}';`,
          ),
        ) >= 7,
      );
      assert.equal(fixtureHash(), before);
    },
  );
  await check(
    "submission quota and stable private inbox cursor are enforced in actual REST",
    async () => {
      for (let i = 0; i < 4; i++) {
        const r = await submit(reporter);
        assert.equal(r.error, null);
        caseIds.push(r.data);
      }
      assert.equal((await submit(reporter)).error?.code, "PT429");
      sql(
        `update adme_review.cases set created_at='2000-01-01T00:00:00.123456Z' where submitter_id='${ids.reporter}';`,
      );
      const found = [];
      let cursor = {};
      for (let i = 0; i < 4; i++) {
        const r = await inbox(reporter, { p_limit: 2, ...cursor });
        assert.equal(r.error, null);
        found.push(...r.data.items.map((x) => x.id));
        if (!r.data.nextCursor) break;
        cursor = {
          p_before: r.data.nextCursor.createdAt,
          p_before_id: r.data.nextCursor.id,
        };
      }
      assert.equal(found.length, 5);
      assert.equal(new Set(found).size, 5);
      assert.deepEqual(found, [...found].sort().reverse());
      assert.equal(
        (await reporter.rpc("review_inbox", {}, { get: true })).status,
        405,
      );
    },
  );
} finally {
  // Owner-only fixture cleanup, in the explicitly guarded disposable DB. Locks
  // prevent concurrent writes while history DELETE guards are temporarily disabled.
  const list = caseIds.length
    ? caseIds.map((id) => `'${id}'`).join(",")
    : "'00000000-0000-0000-0000-000000000000'";
  sql(`begin; alter table adme_review.revisions disable trigger user; alter table adme_review.decisions disable trigger user; alter table adme_review.responses disable trigger user;
    delete from adme_review.decisions where case_id in (${list}); delete from adme_review.responses where case_id in (${list}); delete from adme_review.revisions where case_id in (${list}); delete from adme_review.cases where id in (${list});
    alter table adme_review.revisions enable trigger user; alter table adme_review.decisions enable trigger user; alter table adme_review.responses enable trigger user; commit;
    delete from public.audit_log where entity_id in (${list}); delete from public.creators where id='${creatorId}';
    delete from adme_ops.rate_windows where subject in ('${ids.reporter}','${ids.owner}','${ids.other}'); delete from auth.users where id in ('${ids.reporter}','${ids.owner}','${ids.other}');
    update adme_review.policy set enabled=${policy.enabled},version=${policy.version === null ? "null" : "'" + policy.version.replaceAll("'", "''") + "'"},approval_ref=${policy.approval_ref === null ? "null" : "'" + policy.approval_ref.replaceAll("'", "''") + "'"} where singleton;`);
}
writeFileSync(
  "output/dev-a-db/review-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "actual loopback PostgreSQL/PostgREST, synthetic JWTs and fictional evidence; policy enabled only as explicit local fixture and restored",
      results,
    },
    null,
    2,
  ),
);
