// Actual isolated database/Storage APIs; every actor, file and approval below is fictional.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const ownerId = randomUUID(),
  otherId = randomUUID(),
  creatorId = randomUUID(),
  campaign = randomUUID(),
  copy = randomUUID();
const budgetCampaigns = [randomUUID(), randomUUID()];
const owner = localClient(undefined, localJwt(ownerId)),
  other = localClient(undefined, localJwt(otherId)),
  creator = localClient(undefined, localJwt(creatorId)),
  anon = localClient();
const service = localClient(localRuntime().SERVICE_ROLE_KEY),
  bucket = "adme-campaign-briefs",
  results = [],
  objects = [];
const controls = JSON.parse(
  sql("select to_jsonb(c)from adme_brief.controls c"),
);
const check = async (name, fn) => {
  await fn();
  results.push({ name, result: "PASS" });
  console.log("PASS " + name);
};
const page = async (client = owner, id = campaign) =>
  client.rpc("campaign_brief_page", { p_campaign: id });
const change = (args) =>
  service.rpc("campaign_brief_change", {
    p_actor: ownerId,
    p_campaign: campaign,
    p_expected: 0,
    p_key: randomUUID(),
    p_action: "upload",
    p_file: null,
    p_metadata: null,
    ...args,
  });
async function upload(target = campaign) {
  const id = randomUUID(),
    bytes = Buffer.from("FICTIONAL non-executable contract bytes");
  const path = `${target}/${id}.pdf`;
  const result = await service.storage
    .from(bucket)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false });
  assert.equal(result.error, null);
  objects.push(path);
  return {
    id,
    metadata: {
      path,
      name: "가상 brief.pdf",
      mime: "application/pdf",
      size: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}
try {
  sql(`insert into auth.users(id,raw_user_meta_data)values('${ownerId}','{"role":"brand","name":"가상 brief 소유자"}'),('${otherId}','{"role":"brand","name":"가상 다른 브랜드"}'),('${creatorId}','{"role":"creator","name":"가상 크리에이터"}');
    insert into public.campaigns(id,owner_id,brief,status)select '${campaign}','${ownerId}',brief,'draft'from public.campaigns limit 1;
    insert into public.campaigns(id,owner_id,brief,status)select '${copy}','${ownerId}',brief,'draft'from public.campaigns limit 1;`);
  await check(
    "owner-only minimal page; opposite/foreign/anonymous roles and direct write/table bypasses denied",
    async () => {
      assert.equal((await page()).error, null);
      for (const client of [other, creator])
        assert.equal((await page(client)).error?.code, "P0002");
      assert.equal((await page(anon)).error?.code, "42501");
      for (const client of [owner, other, creator, anon])
        assert.equal(
          (
            await client.rpc("campaign_brief_change", {
              p_actor: ownerId,
              p_campaign: campaign,
              p_expected: 0,
              p_key: randomUUID(),
              p_action: "clear",
              p_file: null,
              p_metadata: null,
            })
          ).error?.code,
          "42501",
        );
      for (const role of ["anon", "authenticated", "service_role"])
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_brief.files','select')or has_table_privilege('${role}','adme_brief.versions','update');`,
          ),
          "f",
        );
    },
  );
  const first = await upload(),
    requestKey = randomUUID();
  const args = {
    p_file: first.id,
    p_metadata: first.metadata,
    p_key: requestKey,
  };
  await check(
    "policy defaults OFF and service cannot bind a forged actor or missing verified object",
    async () => {
      assert.equal((await change(args)).error?.code, "42501");
      sql(
        "update adme_brief.controls set enabled=true,policy_ref='FICTIONAL local policy, not approval',retention_days=1;",
      );
      assert.equal(
        (await change({ ...args, p_actor: otherId })).error?.code,
        "P0002",
      );
      const missing = randomUUID();
      assert.equal(
        (
          await change({
            ...args,
            p_file: missing,
            p_metadata: {
              ...first.metadata,
              path: `${campaign}/${missing}.pdf`,
            },
          })
        ).error?.code,
        "22023",
      );
    },
  );
  await check(
    "concurrent same-key replay commits one immutable version; changed payload and stale CAS reject",
    async () => {
      const responses = await Promise.all(
        Array.from({ length: 5 }, () => change(args)),
      );
      assert.ok(responses.every((r) => !r.error));
      assert.ok(responses.every((r) => r.data.revision === 1));
      assert.equal(
        (
          await change({
            ...args,
            p_metadata: { ...first.metadata, name: "changed.pdf" },
          })
        ).error?.code,
        "23505",
      );
      assert.equal(
        (await change({ p_expected: 0, p_action: "clear" })).error?.code,
        "40001",
      );
      assert.equal(
        sql(
          `select count(*)from adme_brief.versions where campaign_id='${campaign}';`,
        ),
        "1",
      );
      const retry = await owner.rpc("campaign_brief_retry", {
        p_campaign: campaign,
        p_key: requestKey,
        p_action: "upload",
        p_file: first.id,
        p_metadata: first.metadata,
      });
      assert.equal(retry.data.revision, 1);
      assert.equal(
        sql(
          `select rights_confirmed::text||':'||(policy_ref='FICTIONAL local policy, not approval')::text from adme_brief.files where id='${first.id}';`,
        ),
        "true:true",
      );
    },
  );
  await check(
    "actual private object is owner-only, immutable and restored with a new pointer version",
    async () => {
      assert.equal(
        (await owner.storage.from(bucket).download(first.metadata.path)).error,
        null,
      );
      for (const client of [other, creator, anon])
        assert.ok(
          (await client.storage.from(bucket).download(first.metadata.path))
            .error,
        );
      assert.ok(
        (
          await owner.storage
            .from(bucket)
            .upload(first.metadata.path, Buffer.from("overwrite"), {
              upsert: true,
              contentType: "application/pdf",
            })
        ).error,
      );
      assert.equal(
        (await change({ p_expected: 1, p_action: "clear" })).data.revision,
        2,
      );
      assert.equal(
        (await change({ p_expected: 2, p_action: "restore", p_file: first.id }))
          .data.revision,
        3,
      );
      const data = (await page()).data;
      assert.equal(data.activeFile, first.id);
      assert.equal(data.history.length, 3);
      assert.equal(data.files.length, 1);
      for (const privateValue of [
        ownerId,
        otherId,
        first.metadata.path,
        first.metadata.sha256,
        "policy_ref",
      ])
        assert.ok(!JSON.stringify(data).includes(privateValue));
      assert.equal((await page(owner, copy)).data.revision, 0);
      assert.deepEqual((await page(owner, copy)).data.files, []);
      assert.equal(
        (
          await owner.rpc("campaign_brief_file", {
            p_campaign: copy,
            p_file: first.id,
          })
        ).data,
        null,
      );
      assert.throws(
        () =>
          sql(
            `update adme_brief.files set name='changed'where id='${first.id}';`,
          ),
        /brief history is immutable/,
      );
    },
  );
  await check(
    "policy-off permits clear and owned read but rejects restoring; fake actor and copy cannot inherit grants",
    async () => {
      sql("update adme_brief.controls set enabled=false;");
      assert.equal(
        (await change({ p_expected: 3, p_action: "clear" })).data.revision,
        4,
      );
      assert.equal(
        (await change({ p_expected: 4, p_action: "restore", p_file: first.id }))
          .error?.code,
        "42501",
      );
      assert.equal(
        (await owner.storage.from(bucket).download(first.metadata.path)).error,
        null,
      );
      assert.equal(
        (
          await change({
            p_campaign: copy,
            p_expected: 0,
            p_action: "restore",
            p_file: first.id,
          })
        ).error?.code,
        "42501",
      );
    },
  );
  await check(
    "expired historical fixtures expose no active pointer/name/download and cannot be restored",
    async () => {
      const expired = randomUUID(),
        path = `${copy}/${expired}.pdf`,
        bytes = Buffer.from("FICTIONAL expired fixture");
      assert.equal(
        (
          await service.storage.from(bucket).upload(path, bytes, {
            contentType: "application/pdf",
            upsert: false,
          })
        ).error,
        null,
      );
      objects.push(path);
      sql(`insert into adme_brief.files(id,campaign_id,owner_id,path,mime,size_bytes,name,sha256,expires_at,rights_confirmed,policy_ref)values('${expired}','${copy}','${ownerId}','${path}','application/pdf',${bytes.length},'FICTIONAL expired.pdf','${createHash("sha256").update(bytes).digest("hex")}',now()-interval '1 second',true,'FICTIONAL historical policy');
      insert into adme_brief.state(campaign_id,owner_id,revision,active_file)values('${copy}','${ownerId}',1,'${expired}');
      insert into adme_brief.versions(campaign_id,revision,owner_id,file_id,action,request_key,fingerprint)values('${copy}',1,'${ownerId}','${expired}','upload',gen_random_uuid(),decode(repeat('aa',32),'hex'));
      update adme_brief.controls set enabled=true;`);
      const data = (await page(owner, copy)).data;
      assert.equal(data.activeFile, null);
      assert.equal(data.files[0].fileId, null);
      assert.equal(data.files[0].name, null);
      assert.ok((await owner.storage.from(bucket).download(path)).error);
      assert.equal(
        (
          await change({
            p_campaign: copy,
            p_expected: 1,
            p_action: "restore",
            p_file: expired,
          })
        ).error?.code,
        "P0002",
      );
    },
  );
  await check(
    "account cap serializes competing uploads across different campaigns without exceeding20 files",
    async () => {
      for (const id of budgetCampaigns)
        sql(
          `insert into public.campaigns(id,owner_id,brief,status)select '${id}','${ownerId}',brief,'draft'from public.campaigns limit 1;`,
        );
      for (let revision = 0; revision < 17; revision++) {
        const file = await upload(budgetCampaigns[0]);
        const result = await change({
          p_campaign: budgetCampaigns[0],
          p_expected: revision,
          p_file: file.id,
          p_metadata: file.metadata,
        });
        assert.equal(result.error, null);
      }
      const uploads = await Promise.all(
        budgetCampaigns.map((id) => upload(id)),
      );
      const race = await Promise.all(
        uploads.map((file, index) =>
          change({
            p_campaign: budgetCampaigns[index],
            p_expected: index === 0 ? 17 : 0,
            p_file: file.id,
            p_metadata: file.metadata,
          }),
        ),
      );
      assert.equal(race.filter((result) => !result.error).length, 1);
      assert.equal(race.find((result) => result.error)?.error.code, "54000");
      assert.equal(
        sql(
          `select count(*)from adme_brief.files where owner_id='${ownerId}';`,
        ),
        "20",
      );
      sql(
        `delete from public.campaigns where id in('${budgetCampaigns[0]}','${budgetCampaigns[1]}');`,
      );
    },
  );
  await check(
    "parent deletion removes private metadata/history without mutating legacy campaigns or making objects public",
    async () => {
      sql(`delete from public.campaigns where id='${campaign}';`);
      assert.equal(
        sql(
          `select count(*)from adme_brief.versions where campaign_id='${campaign}';`,
        ),
        "0",
      );
      assert.ok(
        (await owner.storage.from(bucket).download(first.metadata.path)).error,
      );
      assert.equal(
        sql(
          "select public::text from storage.buckets where id='adme-campaign-briefs';",
        ),
        "false",
      );
    },
  );
  await check(
    "existing account parent-cleanup gate is preserved; deleted actors cannot recover file access",
    async () => {
      assert.throws(
        () => sql(`delete from auth.users where id='${ownerId}';`),
        /campaigns_owner_id_fkey/,
      );
      assert.equal(
        sql(
          `select count(*)from adme_brief.files where owner_id='${ownerId}';`,
        ),
        "1",
      );
      sql(
        `delete from public.campaigns where id='${copy}';delete from auth.users where id='${ownerId}';`,
      );
      assert.equal(
        sql(
          `select count(*)from adme_brief.files where owner_id='${ownerId}';`,
        ),
        "0",
      );
      assert.equal((await page(owner, copy)).error?.code, "P0002");
    },
  );
} finally {
  if (objects.length)
    assert.equal(
      (await service.storage.from(bucket).remove(objects)).error,
      null,
    );
  sql(`delete from public.campaigns where id in('${campaign}','${copy}','${budgetCampaigns[0]}','${budgetCampaigns[1]}');delete from auth.users where id in('${ownerId}','${otherId}','${creatorId}');
    delete from adme_ops.rate_windows where subject in('${ownerId}','${otherId}','${creatorId}');
    update adme_brief.controls set enabled=${controls.enabled},policy_ref=${controls.policy_ref == null ? "null" : "'" + controls.policy_ref.replaceAll("'", "''") + "'"},retention_days=${controls.retention_days ?? "null"};`);
}
writeFileSync(
  "output/dev-a-db/brief-files-security.local.json",
  JSON.stringify(
    {
      result: "PASS",
      scope:
        "actual isolated SQL/PostgREST/Storage with synthetic role tokens, fictional files/policy; Storage fixtures are not API content verification",
      results,
    },
    null,
    2,
  ),
);
