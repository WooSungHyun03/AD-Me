import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { localRuntime, localClient, sql } from "./local-qa.mjs";
import { qaSignupConsent } from "./consent-fixture.mjs";
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
export async function recruitmentFixture() {
  localRuntime();
  const admin = localClient(localRuntime().SERVICE_ROLE_KEY),
    people = [],
    campaigns = [],
    channels = [];
  const suffix = randomUUID().slice(0, 8),
    oldBilling = sql("select enabled from adme_release.billing_boundary");
  sql(
    "select adme_release.set_test_billing(false,'local-recruitment-fixture-only')",
  );
  async function person(role) {
    const credentials = {
      email: `d043-${randomUUID()}@example.test`,
      password: randomUUID() + "Aa1!",
    };
    const made = await admin.auth.admin.createUser({
      ...credentials,
      email_confirm: true,
      user_metadata: { ...qaSignupConsent, role, name: "가상 모집 QA" },
    });
    assert.equal(made.error, null);
    const id = made.data.user.id,
      db = localClient();
    people.push(id);
    assert.equal((await db.auth.signInWithPassword(credentials)).error, null);
    const creatorId = "user-" + id;
    if (role === "creator") {
      const channel = "UC" + randomUUID().replaceAll("-", "").slice(0, 22);
      channels.push(channel);
      const base = JSON.parse(
        readFileSync("fixtures/creators.demo.json", "utf8"),
      )[0];
      const profile = {
        ...base,
        name: "가상 모집 QA 채널",
        is_demo: false,
        owner_id: id,
        owner_consent: true,
        platforms: ["youtube"],
        is_available: true,
      };
      sql(`insert into public.creators(id,owner_id,published,claim_status,profile)values('${creatorId}','${id}',true,'verified','${literal(profile)}');
    insert into adme_ops.channels(channel_id,title,review)values('${channel}','가상 모집 QA 채널','accepted');
    insert into adme_ops.channel_claims(channel_id,owner_id,verified_at,consent_at)values('${channel}','${id}',now(),now());`);
    }
    return { ...credentials, id, db, creatorId };
  }
  async function cleanup() {
    if (campaigns.length)
      sql(
        `delete from public.proposals where campaign_id=any(array[${campaigns.map((id) => `'${id}'::uuid`).join(",")}]);delete from public.campaigns where id=any(array[${campaigns.map((id) => `'${id}'::uuid`).join(",")}]);`,
      );
    if (people.length)
      sql(
        `delete from public.brand_products where owner_id=any(array[${people.map((id) => `'${id}'::uuid`).join(",")}]);`,
      );
    if (people.length)
      sql(
        `delete from adme_ops.channel_claims where owner_id=any(array[${people.map((id) => `'${id}'::uuid`).join(",")}]);delete from public.creators where owner_id=any(array[${people.map((id) => `'${id}'::uuid`).join(",")}]);delete from public.audit_log where actor_id=any(array[${people.map((id) => `'${id}'::uuid`).join(",")}]);`,
      );
    for (const id of people)
      assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    if (channels.length)
      sql(
        `delete from adme_ops.channels where channel_id=any(array[${channels.map((id) => `'${id}'`).join(",")}]);`,
      );
    sql(
      `select adme_release.set_test_billing(${oldBilling === "t"},'restore-local-recruitment-fixture')`,
    );
  }
  try {
    const brand = await person("brand"),
      other = await person("brand"),
      creators = [];
    for (let i = 0; i < 3; i++) creators.push(await person("creator"));
    const product = await brand.db
      .from("brand_products")
      .insert({
        name: "가상 검증 상품",
        description: "격리 모집 계약 검증 상품입니다.",
      })
      .select("id")
      .single();
    assert.equal(product.error, null);
    const minute = (offset) =>
      new Date(
        Math.floor(Date.now() / 60000) * 60000 + offset * 60000,
      ).toISOString();
    function terms(start = -10, end = 10) {
      return {
        version: 2,
        recruitment: { start: minute(start), end: minute(end) },
        production: { start: minute(60), end: minute(120) },
        posting: { start: minute(180), end: minute(240) },
        compensation: { mode: "unknown" },
        deliverables: [
          {
            format: "숏폼",
            quantity: 1,
            usageRights: "본인 채널 30일",
            exclusivity: null,
          },
        ],
      };
    }
    /** @param {string} name
     * @param {{window?: ReturnType<typeof terms>|null, capacity?: number|null, job?: boolean, deadline?: string|null, status?: string}} options
     */
    async function campaign(
      name,
      {
        window = terms(),
        capacity = null,
        job = true,
        deadline = null,
        status = "published",
      } = {},
    ) {
      const brief = {
        title: `가상 ${name} ${suffix}`,
        product: "가상 검증 상품",
        category: "교육",
        vibes: ["자연스러움"],
        format: "숏폼",
        platforms: ["youtube"],
        budget_krw: 100000,
        target_audience: "성인 가상 QA",
        goal: "로컬 모집 경계 검증",
        status,
        ...(window ? { terms: window } : {}),
      };
      const made = await brand.db
        .from("campaigns")
        .insert({
          owner_id: brand.id,
          brief,
          status,
          recruit_until: deadline,
          capacity,
        })
        .select("id")
        .single();
      assert.equal(made.error, null, made.error?.message);
      const id = made.data.id;
      campaigns.push(id);
      if (job)
        sql(
          `insert into adme_ops.job_posts(campaign_id,product_id,published_at,expires_at)values('${id}','${product.data.id}',now(),now()+interval'30 days')`,
        );
      return { id, title: brief.title, brief };
    }
    return { brand, other, creators, campaign, terms, minute, suffix, cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
