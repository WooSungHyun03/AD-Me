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
const accounts = JSON.parse(
    readFileSync("output/dev-a-db/accounts.local.json", "utf8"),
  ),
  ids = [randomUUID(), randomUUID(), randomUUID()],
  creator = "user-" + ids[0],
  cases = [],
  owner = localClient(undefined, localJwt(ids[0])),
  brand = localClient(undefined, localJwt(ids[1])),
  other = localClient(undefined, localJwt(ids[2])),
  anon = localClient(),
  admin = localClient(undefined, localJwt(accounts.admin.id)),
  old = JSON.parse(sql("select to_jsonb(p)::text from adme_review.policy p;")),
  results = [];
const check = async (name, fn) => {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const page = async (client = anon, extra = {}) => {
  const r = await client.rpc("ad_history_page", {
    p_creator: creator,
    p_limit: 2,
    ...extra,
  });
  assert.equal(r.error, null, JSON.stringify(r.error));
  return r.data;
};
try {
  for (let i = 0; i < 3; i++)
    sql(
      `insert into auth.users(id,raw_user_meta_data)values('${ids[i]}','{"role":"${i ? "brand" : "creator"}","name":"가상 timeline QA"}');`,
    );
  sql(
    `insert into public.creators(id,owner_id,published,profile)select '${creator}','${ids[0]}',true,profile from public.creators where id='creator-001';update adme_review.policy set ad_enabled=true,ad_version='fictional-timeline',ad_approval_ref='https://example.test/fictional-timeline';`,
  );
  for (let i = 0; i < 4; i++) {
    const p = {
      brandLabel: i % 2 ? "가상 둘" : "가상 하나",
      category: i % 2 ? "교육" : "뷰티",
      format: "숏폼",
      startedOn: "2025-01-0" + (i + 1),
      endedOn: "2025-01-31",
      interest: "paid",
      disclosure: "visible",
      evidenceKind: "official_confirmation",
      sourceUrl: "https://example.test/fictional-timeline-" + i,
      ownershipConfirmed: true,
    };
    const r = await owner.rpc("review_submit", {
      p_kind: "ad",
      p_creator: creator,
      p_key: randomUUID(),
      p_payload: p,
    });
    assert.equal(r.error, null);
    cases.push(r.data);
    if (i < 3) {
      const d = await admin.rpc("review_decide", {
        p_id: r.data,
        p_expected: 1,
        p_verdict: "approved",
        p_classification: "ad_evidence",
        p_note: "FICTIONAL_PRIVATE_CANARY",
        p_summary: "가상 광고 근거 검토 요약입니다.",
        p_publish: true,
      });
      assert.equal(d.error, null);
    }
  }
  await check(
    "latest verified evidence only; stable keyset and period-overlap filtered totals",
    async () => {
      const a = await page();
      assert.equal(a.total, 3);
      assert.equal(a.items.length, 2);
      const b = await page(anon, { p_after: a.nextCursor });
      assert.equal(b.items.length, 1);
      assert.equal(
        new Set([...a.items, ...b.items].map((x) => x.record.id)).size,
        3,
      );
      assert.equal(
        (
          await page(anon, {
            p_brand: "하나",
            p_category: "뷰티",
            p_from: "2025-01-03",
            p_to: "2025-01-03",
          })
        ).total,
        2,
      );
      assert.equal(
        (
          await anon.rpc("ad_history_page", {
            p_creator: creator,
            p_brand: "changed",
            p_after: a.nextCursor,
          })
        ).error?.code,
        "22023",
      );
      const out = JSON.stringify(a);
      for (const secret of [
        ...ids,
        "FICTIONAL_PRIVATE_CANARY",
        "ownershipConfirmed",
      ])
        assert.ok(!out.includes(secret));
    },
  );
  await check(
    "brand-private rival replacement; cross-account/anonymous/creator access denied",
    async () => {
      assert.equal(
        (
          await brand.rpc("set_ad_competitors", {
            p_labels: ["가상 하나", "가상 하나"],
          })
        ).error,
        null,
      );
      assert.deepEqual((await other.rpc("my_ad_competitors")).data, []);
      for (const client of [anon, owner])
        assert.ok(
          (await client.rpc("set_ad_competitors", { p_labels: ["가상 하나"] }))
            .error,
        );
      const a = await page(brand),
        b = await page(other),
        c = await page();
      assert.ok(a.items.some((x) => x.competitor));
      assert.ok(b.items.every((x) => !x.competitor));
      assert.ok(c.items.every((x) => !x.competitor));
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_review.competitors','select');`,
          ),
          "f",
        );
    },
  );
  await check(
    "correction and withdrawal update timeline totals immediately; policy/restriction fails closed",
    async () => {
      const r = await owner.rpc("review_withdraw", {
        p_id: cases[0],
        p_expected: 1,
      });
      assert.equal(r.error, null);
      assert.equal((await page()).total, 2);
      sql(
        `update public.creators set moderation_status='restricted'where id='${creator}';`,
      );
      assert.equal((await page()).total, 0);
      sql(
        `update public.creators set moderation_status='allowed'where id='${creator}';update adme_review.policy set ad_enabled=false;`,
      );
      assert.equal((await page()).total, 0);
    },
  );
} finally {
  cleanReviewFixtures(cases);
  sql(
    `delete from public.creators where id='${creator}';delete from adme_ops.rate_windows where subject in('${ids.join("','")}');delete from auth.users where id in('${ids.join("','")}');`,
  );
  const val = (v) =>
    v === null
      ? "null"
      : typeof v === "boolean"
        ? String(v)
        : "'" + v.replaceAll("'", "''") + "'";
  sql(
    `update adme_review.policy set ${["enabled", "version", "approval_ref", "ad_enabled", "ad_version", "ad_approval_ref"].map((k) => k + "=" + val(old[k])).join(",")};`,
  );
}
writeFileSync(
  "harness/evidence/DEV-A-READY-20261122/ad-timeline-security.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "Actual local DB/PostgREST; fictional profiles/ad evidence/policy; no provider or legal approval",
      results,
    },
    null,
    2,
  ) + "\n",
);
