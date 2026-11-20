import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import { cleanReviewFixtures } from "./support/review-fixture-cleanup.mjs";
localRuntime();
const a = JSON.parse(
  readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
);
const uid = randomUUID(),
  foreign = randomUUID(),
  brandId = randomUUID(),
  creatorId = `user-${uid}`,
  caseIds = [],
  results = [];
const owner = localClient(undefined, localJwt(uid)),
  other = localClient(undefined, localJwt(foreign)),
  brand = localClient(undefined, localJwt(brandId)),
  admin = localClient(undefined, localJwt(a.admin.id)),
  anon = localClient();
const oldPolicy = JSON.parse(
  sql("select to_jsonb(p)::text from adme_review.policy p;"),
);
const payload = {
  brandLabel: "가상 브랜드 협업",
  category: "교육",
  format: "숏폼",
  startedOn: "2025-01-01",
  endedOn: "2025-01-31",
  interest: "paid",
  disclosure: "visible",
  evidenceKind: "brand_mention",
  sourceUrl: "https://example.test/fictional-ad-evidence",
  ownershipConfirmed: true,
};
const submit = (client, p_payload = payload, p_key = randomUUID()) =>
  client.rpc("review_submit", {
    p_kind: "ad",
    p_creator: creatorId,
    p_payload,
    p_key,
  });
const rows = async (kind = "ad") => {
  const r = await anon.rpc("public_review_records", {
    p_creator: creatorId,
    p_kind: kind,
  });
  assert.equal(r.error, null);
  return r.data;
};
const review = (id, version, extra = {}) =>
  admin.rpc("review_decide", {
    p_id: id,
    p_expected: version,
    p_verdict: "approved",
    p_classification: "ad_evidence",
    p_note: "FICTIONAL_PRIVATE_AD_REVIEW",
    p_summary: "가상 자료에서 확인한 광고 근거의 요약입니다.",
    p_publish: true,
    ...extra,
  });
const revise = (id, version, p_payload) =>
  owner.rpc("review_revise", { p_id: id, p_expected: version, p_payload });
const check = async (name, fn) => {
  await fn();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const adHash = () =>
  sql(
    "select coalesce(md5(string_agg(id||data::text,',' order by id)),'empty') from public.ad_collaborations;",
  );
const before = adHash();
let first, second, issue;
let version = 1;
const retry = randomUUID();
try {
  for (const [id, role] of [
    [uid, "creator"],
    [foreign, "creator"],
    [brandId, "brand"],
  ])
    sql(
      `insert into auth.users(id,raw_user_meta_data) values('${id}','{"role":"${role}","name":"가상 광고 근거 QA"}');`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${uid}',true,profile from public.creators where id='creator-001';update adme_review.policy set ad_enabled=false where singleton;`,
  );
  await check(
    "owner-only submission, explicit attestation, typed dates and private-key allowlist are enforced",
    async () => {
      for (const client of [anon, other, brand])
        assert.equal((await submit(client)).error?.code, "42501");
      for (const p of [
        { ...payload, ownershipConfirmed: false },
        { ...payload, verified: true },
        { ...payload, is_demo: false },
        { ...payload, startedOn: "2025-02-30" },
        { ...payload, endedOn: "2999-01-01" },
        { ...payload, sourceUrl: "https://user:secret@example.org/x" },
      ])
        assert.equal((await submit(owner, p)).error?.code, "22023");
    },
  );
  await check(
    "concurrent same-key retry is one case with server-derived demo/actor; duplicate source and correction collision roll back",
    async () => {
      const r = await Promise.all(
        Array.from({ length: 8 }, () => submit(owner, payload, retry)),
      );
      assert.ok(
        r.every((x) => !x.error),
        JSON.stringify(r.find((x) => x.error)?.error),
      );
      assert.equal(new Set(r.map((x) => x.data)).size, 1);
      first = r[0].data;
      caseIds.push(first);
      assert.equal((await submit(owner)).error?.code, "23505");
      const b = await submit(owner, {
        ...payload,
        sourceUrl: "https://example.test/fictional-ad-second",
      });
      assert.equal(b.error, null);
      second = b.data;
      caseIds.push(second);
      assert.equal((await revise(second, 1, payload)).error?.code, "23505");
      assert.equal(
        sql(`select version from adme_review.cases where id='${second}';`),
        "1",
      );
      assert.equal(
        sql(
          `select is_demo::text||','||submitter_id::text from adme_review.cases where id='${first}';`,
        ),
        `true,${uid}`,
      );
      assert.deepEqual(await rows(), []);
    },
  );
  await check(
    "issue policy alone never enables advertising publication and brand mention is not accepted evidence",
    async () => {
      sql(
        "update adme_review.policy set enabled=true,version='fixture-issue-v1',approval_ref='https://example.test/fixture-issue' where singleton;",
      );
      assert.equal((await review(first, version)).error?.code, "23514");
      assert.equal(
        (await review(first, version, { p_publish: false })).error?.code,
        "23514",
      );
      sql(
        "update adme_review.policy set ad_enabled=true,ad_version='fixture-ad-v1',ad_approval_ref='https://example.test/fixture-ad' where singleton;",
      );
      assert.equal((await review(first, version)).error?.code, "23514");
      assert.equal(
        (
          await revise(first, version, {
            ...payload,
            evidenceKind: "official_confirmation",
          })
        ).error,
        null,
      );
      version = 2;
      assert.equal((await submit(owner, payload, retry)).data, first);
    },
  );
  await check(
    "self declaration and unknown economic interest cannot be published as confirmed advertising",
    async () => {
      for (const extra of [
        { evidenceKind: "self_declaration" },
        { evidenceKind: "official_confirmation", interest: "unknown" },
      ]) {
        const v = Number(
          sql(`select version from adme_review.cases where id='${second}';`),
        );
        assert.equal(
          (
            await revise(second, v, {
              ...payload,
              sourceUrl: "https://example.test/fictional-ad-second",
              ...extra,
            })
          ).error,
          null,
        );
        assert.equal((await review(second, v + 1)).error?.code, "23514");
        assert.equal(
          (await review(second, v + 1, { p_publish: false })).error?.code,
          "23514",
        );
      }
      assert.equal(
        (await review(first, version, { p_classification: "confirmed_fact" }))
          .error?.code,
        "22023",
      );
    },
  );
  await check(
    "approved advertising exposes bounded public fields without attestation, actor IDs or internal review text",
    async () => {
      assert.equal((await review(first, version)).error, null);
      const out = await rows();
      assert.equal(out.length, 1);
      assert.equal(out[0].classification, "ad_evidence");
      assert.equal(out[0].isDemo, true);
      assert.equal(out[0].payload.brandLabel, payload.brandLabel);
      for (const value of [
        uid,
        a.admin.id,
        "FICTIONAL_PRIVATE_AD_REVIEW",
        "ownershipConfirmed",
        "initial_payload",
      ])
        assert.equal(JSON.stringify(out).includes(value), false);
    },
  );
  await check(
    "correction hides old publication and an older approval cannot approve the new submission",
    async () => {
      const corrected = {
        ...payload,
        brandLabel: "가상 브랜드 정정",
        evidenceKind: "official_confirmation",
      };
      assert.equal((await revise(first, version, corrected)).error, null);
      version = 3;
      assert.deepEqual(await rows(), []);
      assert.equal((await review(first, 2)).error?.code, "40001");
      assert.equal((await review(first, version)).error, null);
      assert.equal((await rows())[0].payload.brandLabel, corrected.brandLabel);
      const inbox = await owner.rpc("review_inbox", {});
      assert.equal(inbox.error, null);
      assert.equal(
        inbox.data.items.find((x) => x.id === first).history[0].payload
          .brandLabel,
        payload.brandLabel,
      );
    },
  );
  await check(
    "advertising and issue publication policy switches/versions are independent",
    async () => {
      const r = await owner.rpc("review_submit", {
        p_kind: "issue",
        p_creator: creatorId,
        p_key: randomUUID(),
        p_payload: {
          reason: "가상 공식 정정 자료에 대한 요청입니다.",
          sourceUrl: "https://example.test/fictional-issue",
          evidenceKind: "correction",
        },
      });
      assert.equal(r.error, null);
      issue = r.data;
      caseIds.push(issue);
      assert.equal(
        (await review(issue, 1, { p_classification: "official_correction" }))
          .error,
        null,
      );
      assert.equal((await rows("issue")).length, 1);
      sql("update adme_review.policy set ad_enabled=false where singleton;");
      assert.deepEqual(await rows(), []);
      assert.equal((await rows("issue")).length, 1);
      sql(
        "update adme_review.policy set ad_enabled=true,ad_version='fixture-ad-v2' where singleton;",
      );
      assert.deepEqual(await rows(), []);
      sql(
        "update adme_review.policy set ad_version='fixture-ad-v1',enabled=false where singleton;",
      );
      assert.equal((await rows()).length, 1);
      assert.deepEqual(await rows("issue"), []);
    },
  );
  await check(
    "withdrawal preserves immutable history and legacy fictional ad data remains unchanged",
    async () => {
      assert.equal(
        (
          await owner.rpc("review_withdraw", {
            p_id: first,
            p_expected: version,
          })
        ).error,
        null,
      );
      assert.deepEqual(await rows(), []);
      assert.throws(
        () =>
          sql(
            `update adme_review.revisions set payload='{}' where case_id='${first}';`,
          ),
        /review history is immutable/,
      );
      assert.equal(adHash(), before);
    },
  );
} finally {
  cleanReviewFixtures(caseIds);
  sql(
    `delete from public.creators where id='${creatorId}';delete from adme_ops.rate_windows where subject in ('${uid}','${foreign}','${brandId}');delete from auth.users where id in ('${uid}','${foreign}','${brandId}');`,
  );
  const val = (v) =>
    v === null
      ? "null"
      : typeof v === "boolean"
        ? String(v)
        : "'" + v.replaceAll("'", "''") + "'";
  sql(
    `update adme_review.policy set ${["enabled", "version", "approval_ref", "ad_enabled", "ad_version", "ad_approval_ref"].map((k) => `${k}=${val(oldPolicy[k])}`).join(",")} where singleton;`,
  );
}
writeFileSync(
  "output/dev-a-db/ad-history-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated actual Auth/PostgREST/SQL, fictional profiles and sources; both policy fixtures restored; no real advertising/provider verification",
      results,
    },
    null,
    2,
  ),
);
