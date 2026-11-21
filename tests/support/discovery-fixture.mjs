import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { localRuntime, localClient, localJwt, sql } from "./local-qa.mjs";
import { cleanReviewFixtures } from "./review-fixture-cleanup.mjs";
export async function createDiscoveryFixture() {
  localRuntime();
  const actor = randomUUID(),
    creator = "user-" + actor,
    identity = randomUUID(),
    policy = "fixture-" + randomUUID(),
    name = "가상 P1 관측 " + randomUUID().slice(0, 8),
    cases = [],
    oldPolicy = JSON.parse(
      sql("select to_jsonb(p)::text from adme_review.policy p;"),
    ),
    base = JSON.parse(readFileSync("fixtures/creators.demo.json", "utf8"))[0],
    a = JSON.parse(readFileSync("output/dev-a-db/accounts.local.json", "utf8")),
    owner = localClient(undefined, localJwt(actor)),
    admin = localClient(undefined, localJwt(a.admin.id)),
    brand = localClient(undefined, localJwt(a.brand.id)),
    oldLabels = (await brand.rpc("my_ad_competitors")).data;
  const lit = (v) => JSON.stringify(v).replaceAll("'", "''");
  sql(`insert into auth.users(id,raw_user_meta_data)values('${actor}','{"role":"creator","name":"가상 P1 관측"}');insert into public.creators(id,owner_id,published,profile)values('${creator}','${actor}',true,'${lit({ ...base, name, bio: "가상 UI 검증 자료입니다.", is_demo: true, owner_consent: true })}');
 insert into adme_creator.identities(id,creator_id,provider,external_id,display_name,canonical_url,observed_at,source_type,policy_version,claim_status,owner_consent,publication_status)select '${identity}',id,'approved_web','fictional-${identity}','가상 관측 기록','https://example.test/fictional-observation',now(),'synthetic_demo','${policy}','claimed',true,'published'from adme_creator.records where legacy_creator_id='${creator}';
 insert into adme_creator.publication_policies(provider,policy_version,enabled,permission_ref,ttl_seconds,metric_units,derived_allowed)values('approved_web','${policy}',true,'FICTIONAL LOCAL UI ONLY',3600,'{"views":"count","engagement_rate":"percent"}',true);
 insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind)values('${identity}','views',0,'count',now()-interval'2 hours','https://example.test/fictional-observation','${policy}','original'),('${identity}','views',null,'count',now()-interval'1 hour','https://example.test/fictional-observation','${policy}','original'),('${identity}','views',10,'count',now()-interval'5 minutes','https://example.test/fictional-observation','${policy}','original');
 insert into adme_creator.metric_observations(identity_id,name,value,unit,observed_at,source_url,policy_version,kind,formula_text,sample_size,period_start,period_end)values('${identity}','engagement_rate',0,'percent',now(),'https://example.test/fictional-observation','${policy}','derived','가상: interactions / observed views * 100',3,now()-interval'1 hour',now());
 update adme_review.policy set ad_enabled=true,ad_version='${policy}',ad_approval_ref='https://example.test/fictional-review';`);
  sql(`update adme_creator.publication_policies set history_allowed=true,history_permission_ref='FICTIONAL LOCAL HISTORY ONLY',history_window_seconds=14400 where policy_version='${policy}';`);
  for (let n = 0; n < 2; n++) {
    const r = await owner.rpc("review_submit", {
      p_kind: "ad",
      p_creator: creator,
      p_key: randomUUID(),
      p_payload: {
        brandLabel: n ? "가상 교육 브랜드" : "가상 화장품 브랜드",
        category: n ? "교육" : "뷰티",
        format: "숏폼",
        startedOn: "2025-01-01",
        endedOn: "2025-01-31",
        interest: "paid",
        disclosure: "visible",
        evidenceKind: "official_confirmation",
        sourceUrl: "https://example.test/fictional-ad-" + randomUUID(),
        ownershipConfirmed: true,
      },
    });
    if (r.error) throw Error("Fixture submission failed");
    cases.push(r.data);
    const d = await admin.rpc("review_decide", {
      p_id: r.data,
      p_expected: 1,
      p_verdict: "approved",
      p_classification: "ad_evidence",
      p_note: "FICTIONAL PRIVATE UI NOTE",
      p_summary: "가상 제출 자료의 광고 근거 검토 요약입니다.",
      p_publish: true,
    });
    if (d.error) throw Error("Fixture decision failed");
  }
  return {
    creator,
    reference: sql(`select adme_creator.public_reference('${creator}');`),
    name,
    policy,
    cases,
    owner,
    async cleanup() {
      await brand.rpc("set_ad_competitors", { p_labels: oldLabels ?? [] });
      cleanReviewFixtures(cases);
      sql(
        `delete from public.creators where id='${creator}';delete from adme_creator.publication_policies where policy_version='${policy}';delete from auth.users where id='${actor}';`,
      );
      const val = (v) =>
        v === null
          ? "null"
          : typeof v === "boolean"
            ? String(v)
            : "'" + v.replaceAll("'", "''") + "'";
      sql(
        `update adme_review.policy set ${["enabled", "version", "approval_ref", "ad_enabled", "ad_version", "ad_approval_ref"].map((k) => k + "=" + val(oldPolicy[k])).join(",")};`,
      );
    },
  };
}
