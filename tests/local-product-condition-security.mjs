// Real local SQL/PostgREST/queue with fictional actors and synthetic provider output.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
import {
  fictionalProductSource,
  syntheticProductOutput,
} from "./support/product-condition-fixture.mjs";
localRuntime();
const ids = { brand: randomUUID(), other: randomUUID(), creator: randomUUID() },
  products = [randomUUID(), randomUUID(), randomUUID()];
const clients = Object.fromEntries(
    Object.entries(ids).map(([role, id]) => [
      role,
      localClient(undefined, localJwt(id)),
    ]),
  ),
  anon = localClient(),
  token = randomBytes(32).toString("hex");
const oldHash = sql(
    "select coalesce(encode(worker_hash,'hex'),'NULL')from adme_ops.settings",
  ),
  oldLlm = sql("select llm_enabled from adme_ops.resource_controls"),
  control = JSON.parse(
    sql("select to_jsonb(c)from adme_product_conditions.controls c"),
  );
const provider = sql(
  "select coalesce(jsonb_agg(to_jsonb(w)),'[]')from adme_ops.rate_windows w where scope='provider_day'and subject='local_llm'",
);
const counts = sql(
    "select jsonb_build_array((select count(*)from public.orders),(select count(*)from public.messages),(select count(*)from public.entitlements))",
  ),
  results = [];
const literal = (v) => JSON.stringify(v).replaceAll("'", "''");
const check = async (name, fn) => {
  await fn();
  results.push({ name, result: "PASS" });
  console.log(`PASS ${name}`);
};
const create = (
  key = randomUUID(),
  product = products[0],
  client = clients.brand,
  audience = fictionalProductSource.audience,
) =>
  client.rpc("product_conditions_create", {
    p_product: product,
    p_audience: audience,
    p_key: key,
  });
const get = async (id, client = clients.brand) => {
  const r = await client.rpc("product_conditions_get", { p_id: id });
  assert.equal(r.error, null);
  return r.data;
};
const claim = async (id) => {
  sql(
    `update adme_ops.jobs set created_at=now()-interval '10 days',available_at=now()where id='${id}';`,
  );
  const r = await anon.rpc("ops_worker_claim", { p_token: token });
  assert.equal(r.error, null);
  assert.equal(r.data?.id, id);
  return r.data;
};
const finish = (job, output, error = null) =>
  anon.rpc("ops_worker_finish", {
    p_token: token,
    p_id: job.id,
    p_lease: job.lease,
    p_result: output,
    p_error: error,
    p_elapsed: 1,
  });
const decide = (id, key, action = "confirm", selected = [0, 1], revision = 0) =>
  clients.brand.rpc("product_conditions_decide", {
    p_id: id,
    p_key: key,
    p_revision: revision,
    p_action: action,
    p_selected: selected,
  });
let first,
  second,
  third,
  lease,
  output,
  createKey = randomUUID(),
  decisionKey = randomUUID();
try {
  for (const [role, id] of Object.entries(ids))
    sql(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','local-fixture-only','{}','{"role":"${role === "creator" ? "creator" : "brand"}","name":"Fictional product QA"}',now(),now());`,
    );
  for (const id of products)
    sql(
      `insert into public.brand_products(id,owner_id,name,description)values('${id}','${ids.brand}','${fictionalProductSource.name}','${fictionalProductSource.description} PRIVATE qa@example.test 010-1234-5678 https://example.test');`,
    );
  await check(
    "defaultOFF and invalid policy gate create no job; owner role/foreign/raw-table/helper gates deny",
    async () => {
      assert.equal((await create()).error?.code, "PT404");
      assert.throws(() =>
        sql(
          "update adme_product_conditions.controls set enabled=true,policy_ref=null,retention_seconds=null",
        ),
      );
      for (const c of [anon, clients.other, clients.creator])
        assert.ok((await create(randomUUID(), products[0], c)).error);
      for (const role of ["anon", "authenticated", "service_role"]) {
        assert.equal(
          sql(
            `select has_table_privilege('${role}','adme_product_conditions.requests','select')`,
          ),
          "f",
        );
        assert.equal(
          sql(
            `select has_function_privilege('${role}','adme_product_conditions.valid_result(jsonb,adme_product_conditions.requests)','execute')`,
          ),
          "f",
        );
      }
      assert.equal(
        sql(`select count(*)from adme_ops.jobs where owner_id='${ids.brand}'`),
        "0",
      );
    },
  );
  sql(
    `update adme_product_conditions.controls set enabled=true,policy_ref='FICTIONAL local PR001 policy',retention_seconds=3600;update adme_ops.resource_controls set llm_enabled=true;update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8'));delete from adme_ops.rate_windows where scope='provider_day'and subject='local_llm';`,
  );
  await check(
    "contact-only source is rejected after minimization before any quota/job reservation",
    async () => {
      sql(
        `update public.brand_products set description='https://example.test'where id='${products[0]}'`,
      );
      assert.equal((await create()).error?.code, "22023");
      assert.equal(
        sql(`select count(*)from adme_ops.jobs where owner_id='${ids.brand}'`),
        "0",
      );
      sql(
        `update public.brand_products set description='${fictionalProductSource.description} PRIVATE qa@example.test 010-1234-5678 https://example.test'where id='${products[0]}'`,
      );
    },
  );
  await check(
    "five concurrent create retries persist one source/key/quota receipt and reject changed product/audience",
    async () => {
      const writes = await Promise.all(
        Array.from({ length: 5 }, () => create(createKey)),
      );
      for (const r of writes) assert.equal(r.error, null);
      first = writes[0].data;
      assert.equal(new Set(writes.map((r) => r.data)).size, 1);
      assert.equal((await create(createKey, products[1])).error?.code, "23505");
      assert.equal(
        (await create(createKey, products[0], clients.brand, "다른 가상 타깃"))
          .error?.code,
        "23505",
      );
      assert.equal(
        sql(
          `select used from adme_ops.rate_windows where scope='draft_day'and subject='${ids.brand}'`,
        ),
        "1",
      );
      for (const c of [anon, clients.other, clients.creator])
        assert.ok(
          (await c.rpc("product_conditions_get", { p_id: first })).error,
        );
      assert.equal((await get(first)).decision, "pending");
    },
  );
  await check(
    "real budgeted claim delivers minimized bound source; invalid result is withheld and retried under same job",
    async () => {
      lease = await claim(first);
      assert.equal(lease.operation, "product_conditions_v1");
      assert.equal(lease.productSource.name, fictionalProductSource.name);
      for (const privateValue of [
        "qa@example.test",
        "010-1234-5678",
        "https://example.test",
        ids.brand,
      ])
        assert.ok(!JSON.stringify(lease).includes(privateValue));
      assert.equal(
        (
          await anon.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: first,
            p_lease: lease.lease,
          })
        ).data,
        true,
      );
      output = syntheticProductOutput(
        lease.productSource,
        lease.productSourceVersion,
      );
      for (const altered of [
        { ...output, modelSourceVersion: null },
        { ...output, ownerId: ids.other },
        { ...output, sourceVersion: "b".repeat(64) },
        {
          ...output,
          suggestions: [
            {
              kind: "audience",
              value: "30대 여성",
              field: "description",
              quote: "음식",
            },
          ],
        },
      ])
        assert.equal(
          sql(
            `select adme_product_conditions.valid_result('${literal(altered)}',r)from adme_product_conditions.requests r where id='${first}'`,
          ),
          "f",
        );
      const invalid = await finish(lease, { ...output, ownerId: ids.other });
      assert.equal(invalid.error, null);
      assert.equal(invalid.data, true);
      const state = await get(first);
      assert.equal(state.status, "queued");
      assert.equal(state.output, null);
      lease = await claim(first);
      output = syntheticProductOutput(
        lease.productSource,
        lease.productSourceVersion,
      );
      assert.equal((await finish(lease, output)).data, true);
      assert.equal((await finish(lease, output)).data, false);
      assert.equal(
        (await get(first)).output.sourceVersion,
        lease.productSourceVersion,
      );
      assert.equal(
        sql(
          "select used from adme_ops.rate_windows where scope='provider_day'and subject='local_llm'",
        ),
        "2",
      );
    },
  );
  await check(
    "server confirm requires valid indices; five same-key CAS retries produce one immutable decision",
    async () => {
      assert.equal(
        (await decide(first, randomUUID(), "confirm", [])).error?.code,
        "22023",
      );
      assert.equal(
        (await decide(first, randomUUID(), "confirm", [0, 0])).error?.code,
        "22023",
      );
      assert.equal(
        (await decide(first, randomUUID(), "confirm", [7])).error?.code,
        "22023",
      );
      const replies = await Promise.all(
        Array.from({ length: 5 }, () => decide(first, decisionKey)),
      );
      for (const r of replies) {
        assert.equal(r.error, null);
        assert.equal(r.data.decision, "confirmed");
        assert.equal(r.data.revision, 1);
        assert.equal(r.data.selected.length, 2);
      }
      assert.equal(
        (await decide(first, decisionKey, "confirm", [0])).error?.code,
        "23505",
      );
      assert.equal(
        (await decide(first, randomUUID(), "dismiss", [], 1)).error?.code,
        "23505",
      );
      assert.deepEqual(
        (await get(first)).selected.map((x) => x.value),
        ["음식", "제품 리뷰"],
      );
    },
  );
  await check(
    "source change hides old output and prevents stale confirmation without modifying saved selection",
    async () => {
      sql(
        `update public.brand_products set description=description||' changed fixture'where id='${products[0]}'`,
      );
      const state = await get(first);
      assert.equal(state.status, "stale");
      assert.equal(state.output, null);
      assert.equal(state.selected.length, 2);
      const r = await create(randomUUID(), products[1]);
      assert.equal(r.error, null);
      second = r.data;
      const claimed = await claim(second);
      sql(
        `update public.brand_products set description=description||' changed fixture'where id='${products[1]}'`,
      );
      assert.equal(
        (
          await anon.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: second,
            p_lease: claimed.lease,
          })
        ).data,
        false,
      );
      assert.equal(
        (
          await finish(
            claimed,
            syntheticProductOutput(
              claimed.productSource,
              claimed.productSourceVersion,
            ),
          )
        ).data,
        false,
      );
    },
  );
  await check(
    "product deletion revokes an existing lease/result; confirmation is never automatic",
    async () => {
      const r = await create(randomUUID(), products[2]);
      assert.equal(r.error, null);
      third = r.data;
      const claimed = await claim(third);
      sql(`delete from public.brand_products where id='${products[2]}'`);
      assert.equal(
        (
          await anon.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: third,
            p_lease: claimed.lease,
          })
        ).data,
        false,
      );
      assert.equal(
        (
          await finish(
            claimed,
            syntheticProductOutput(
              claimed.productSource,
              claimed.productSourceVersion,
            ),
          )
        ).data,
        false,
      );
      assert.equal(
        (await clients.brand.rpc("product_conditions_get", { p_id: third }))
          .error?.code,
        "PT404",
      );
      assert.equal(
        counts,
        sql(
          "select jsonb_build_array((select count(*)from public.orders),(select count(*)from public.messages),(select count(*)from public.entitlements))",
        ),
      );
    },
  );
  await check(
    "operational deadline terminates pending work; policy expiry physically purges source/result via scheduled sweep",
    async () => {
      const r = await create(randomUUID(), products[0]);
      assert.equal(r.error, null);
      const id = r.data;
      sql(
        `update adme_product_conditions.requests set job_deadline=now()-interval '1 second'where id='${id}'`,
      );
      assert.equal((await get(id)).status, "failed");
      sql(
        `update adme_product_conditions.requests set created_at=now()-interval '2 hours',expires_at=now()-interval '1 second'where owner_id='${ids.brand}';select adme_product_conditions.sweep();`,
      );
      assert.equal(
        sql(
          `select count(*)from adme_product_conditions.requests where owner_id='${ids.brand}'`,
        ),
        "0",
      );
      assert.equal(
        sql(
          `select count(*)from adme_ops.jobs where id in('${first}','${second}','${id}')`,
        ),
        "0",
      );
      assert.equal(
        sql(
          "select active from cron.job where jobname='adme-product-conditions-cleanup'",
        ),
        "t",
      );
    },
  );
  await check(
    "legacy reserved-prefix text remains a normal draft operation",
    async () => {
      const r = await clients.other.rpc("ops_draft_create", {
        p_input: "product-condition-v1:FICTIONAL legacy plaintext",
      });
      assert.equal(r.error, null);
      const legacy = await claim(r.data);
      assert.equal(legacy.operation, undefined);
      assert.equal(legacy.productSource, undefined);
      assert.equal(
        sql(`select operation is null from adme_ops.jobs where id='${r.data}'`),
        "t",
      );
      assert.equal(
        (
          await anon.rpc("ops_worker_heartbeat", {
            p_token: token,
            p_id: legacy.id,
            p_lease: legacy.lease,
          })
        ).data,
        true,
      );
      const { execFileSync } = await import("node:child_process");
      const normal = JSON.parse(
        execFileSync(
          "python",
          [
            "-X",
            "utf8",
            "-c",
            "import sys,json;sys.path.insert(0,'scripts');import intelligence_worker as w;from unittest.mock import patch\np={'model':w.MODEL,'done':True,'done_reason':'stop','prompt_eval_count':120,'eval_count':90,'total_duration':1000000000,'message':{'content':json.dumps({'concept':'가상 검증 초안','outline':['명시적 합성 입력'],'proposal':'발송하지 않은 가상 제안'})}}\nwith patch.object(w,'model_request',return_value=p):r=w.draft('명시적 합성 입력입니다')\nprint(json.dumps(r))",
          ],
          { encoding: "utf8" },
        ),
      );
      assert.equal((await finish(legacy, normal)).data, true);
      const read = await clients.other.rpc("ops_draft_get", { p_id: r.data });
      assert.equal(read.error, null);
      assert.equal(read.data.status, "done");
      assert.deepEqual(read.data.output, normal);
    },
  );
} finally {
  sql(
    `begin;delete from adme_ops.jobs where owner_id in('${ids.brand}','${ids.other}');delete from public.brand_products where owner_id in('${ids.brand}','${ids.other}','${ids.creator}');delete from adme_ops.rate_windows where subject in('${ids.brand}','${ids.other}','${ids.creator}');delete from auth.users where id in('${ids.brand}','${ids.other}','${ids.creator}');delete from adme_ops.rate_windows where scope='provider_day'and subject='local_llm';insert into adme_ops.rate_windows select * from jsonb_populate_recordset(null::adme_ops.rate_windows,'${provider.replaceAll("'", "''")}');update adme_ops.settings set worker_hash=${oldHash === "NULL" ? "null" : `decode('${oldHash}','hex')`};update adme_ops.resource_controls set llm_enabled=${oldLlm === "t"};update adme_product_conditions.controls set enabled=${control.enabled},policy_ref=${control.policy_ref === null ? "null" : `'${control.policy_ref.replaceAll("'", "''")}'`},retention_seconds=${control.retention_seconds ?? "null"};commit;`,
  );
}
writeFileSync(
  "output/20261124-product-condition-security.local.json",
  JSON.stringify(
    {
      scope:
        "actual local SQL/REST/queue/cron; fictional actors/policies and synthetic model output, no operator model startup",
      results,
    },
    null,
    2,
  ) + "\n",
);
