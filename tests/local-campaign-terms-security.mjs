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
const owner = localClient(undefined, localJwt(a.brand.id)),
  other = localClient(undefined, localJwt(a.other.id));
const id = randomUUID();
const base = {
  title: "가상 QA 계약 검증 캠페인",
  product: "가상 제품",
  category: "교육",
  vibes: ["자연스러움"],
  format: "숏폼",
  platforms: ["instagram"],
  budget_krw: 100000,
  target_audience: "로컬 QA",
  goal: "계약 필드 검증",
  status: "draft",
};
const terms = {
  version: 2,
  recruitment: {
    start: "2026-12-31T15:15:00.000Z",
    end: "2027-01-10T09:00:00.000Z",
  },
  production: {
    start: "2027-01-11T00:00:00.000Z",
    end: "2027-01-20T09:00:00.000Z",
  },
  posting: {
    start: "2027-01-21T00:00:00.000Z",
    end: "2027-02-01T09:00:00.000Z",
  },
  compensation: { mode: "unknown" },
  deliverables: [
    {
      format: "숏폼",
      quantity: 1,
      usageRights: "가상 채널30일",
      exclusivity: null,
    },
  ],
};
const results = [];
async function check(name, fn) {
  await fn();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
}
try {
  await check(
    "legacy campaigns remain unchanged; v2 stores exact UTC and explicit unknown without invented zero",
    async () => {
      assert.equal(
        (
          await owner
            .from("campaigns")
            .insert({ id, owner_id: a.brand.id, brief: base })
        ).error,
        null,
      );
      const legacy = await owner
        .from("campaigns")
        .select("brief")
        .eq("id", id)
        .single();
      assert.deepEqual(legacy.data.brief, base);
      assert.equal(
        (
          await owner
            .from("campaigns")
            .update({ brief: { ...base, terms } })
            .eq("id", id)
        ).error,
        null,
      );
      const stored = await owner
        .from("campaigns")
        .select("brief")
        .eq("id", id)
        .single();
      assert.deepEqual(stored.data.brief.terms, terms);
      assert.equal(stored.data.brief.budget_krw, 100000);
      assert.equal(stored.data.brief.terms.compensation.cash, undefined);
    },
  );
  await check(
    "foreign mutation, creator creation and silent removal of v2 terms are denied",
    async () => {
      const foreign = await other
        .from("campaigns")
        .update({
          brief: {
            ...base,
            terms: {
              ...terms,
              compensation: {
                mode: "declared",
                cash: { minimumKrw: 0, maximumKrw: 0 },
              },
            },
          },
        })
        .eq("id", id)
        .select("id");
      assert.equal(foreign.data?.length ?? 0, 0);
      assert.equal(
        (await owner.from("campaigns").update({ brief: base }).eq("id", id))
          .error?.code,
        "22023",
      );
      const creator = localClient(undefined, localJwt(a.creator.id));
      assert.equal(
        (
          await creator
            .from("campaigns")
            .insert({ owner_id: a.creator.id, brief: { ...base, terms } })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "direct REST rejects malformed periods, money, quantities and unsupported nested fields",
    async () => {
      const cases = [
        (t) => {
          t.recruitment.start = "2027-02-30T09:00:00.000Z";
        },
        (t) => {
          t.recruitment.start = t.recruitment.end;
        },
        (t) => {
          t.posting.start = "2026-01-01T00:00:00.000Z";
        },
        (t) => {
          t.recruitment.start = "2027-01-01T00:00";
        },
        (t) => {
          t.production.start = "2027-01-11T09:00:00+09:00";
        },
        (t) => {
          t.posting.start = "2027-01-21T00:00:30.000Z";
        },
        (t) => {
          t.compensation = { mode: "declared" };
        },
        (t) => {
          t.compensation = {
            mode: "declared",
            cash: { minimumKrw: -1, maximumKrw: 10 },
          };
        },
        (t) => {
          t.compensation = {
            mode: "declared",
            cash: { minimumKrw: 2, maximumKrw: 1 },
          };
        },
        (t) => {
          t.compensation = {
            mode: "declared",
            cash: { minimumKrw: 1.5, maximumKrw: 10 },
          };
        },
        (t) => {
          t.compensation = {
            mode: "declared",
            product: { description: "fixture", quantity: 0 },
          };
        },
        (t) => {
          t.compensation = {
            mode: "unknown",
            cash: { minimumKrw: 0, maximumKrw: 0 },
          };
        },
        (t) => {
          t.deliverables = [];
        },
        (t) => {
          t.deliverables[0].quantity = 1.5;
        },
        (t) => {
          t.deliverables[0].quantity = 101;
        },
        (t) => {
          t.deliverables[0].usageRights = "";
        },
        (t) => {
          t.deliverables[0].usageRights = "\n\t\r";
        },
        (t) => {
          t.compensation = {
            mode: "declared",
            product: { description: "\n\t", quantity: 1 },
          };
        },
        (t) => {
          t.deliverables[0].privateContact = "unexpected";
        },
        (t) => {
          delete t.deliverables[0].exclusivity;
        },
        (t) => {
          t.recruitment = null;
        },
        (t) => {
          t.version = "2";
        },
      ];
      for (const mutate of cases) {
        const value = structuredClone(terms);
        mutate(value);
        const response = await owner
          .from("campaigns")
          .update({ brief: { ...base, terms: value } })
          .eq("id", id);
        assert.equal(response.error?.code, "23514", JSON.stringify(value));
      }
    },
  );
  await check(
    "cash-zero, product-only, mixed and explicit recruitment status survive updates and publication",
    async () => {
      for (const compensation of [
        { mode: "declared", cash: { minimumKrw: 0, maximumKrw: 0 } },
        {
          mode: "declared",
          product: { description: "가상 제품", quantity: 2 },
        },
        {
          mode: "declared",
          cash: { minimumKrw: 50000, maximumKrw: 100000 },
          product: { description: "가상 제품", quantity: 1 },
        },
      ]) {
        const brief = {
          ...base,
          terms: { ...terms, compensation },
          status: "published",
        };
        assert.equal(
          (
            await owner
              .from("campaigns")
              .update({ brief, status: "published" })
              .eq("id", id)
          ).error,
          null,
        );
        const visible = await localClient()
          .from("campaigns")
          .select("brief,status")
          .eq("id", id)
          .single();
        assert.equal(visible.error, null);
        assert.deepEqual(visible.data.brief.terms.compensation, compensation);
        assert.equal(visible.data.status, "published");
      }
    },
  );
} finally {
  sql(`delete from public.campaigns where id='${id}';`);
}
writeFileSync(
  "output/dev-a-db/campaign-terms-security.local.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      scope:
        "isolated fictional campaigns and synthetic local JWTs; no real contract/payment",
      results,
    },
    null,
    2,
  ),
);
