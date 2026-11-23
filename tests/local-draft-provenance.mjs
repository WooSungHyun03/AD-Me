import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  localRuntime,
  localClient,
  localJwt,
  sql,
} from "./support/local-qa.mjs";
localRuntime();
const actor = randomUUID(),
  other = randomUUID(),
  job = randomUUID(),
  lease = randomUUID(),
  token = randomBytes(32).toString("hex");
const hash = sql(
  "select coalesce(encode(worker_hash,'hex'),'NULL')from adme_ops.settings where singleton",
);
const enabled = sql("select llm_enabled from adme_ops.resource_controls");
const original = sql("select count(*)from public.orders");
try {
  for (const id of [actor, other])
    sql(
      `insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)values('${id}','00000000-0000-0000-0000-000000000000','authenticated','authenticated','${id}@example.test','local-fixture-only','{}','{"role":"brand","name":"Fictional draft QA"}',now(),now());`,
    );
  sql(`update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8'));update adme_ops.resource_controls set llm_enabled=true;
 insert into adme_ops.jobs(id,kind,owner_id,input,status,lease,lease_until,attempts)values('${job}','marketing_draft','${actor}','가상 provenance fixture입니다','running','${lease}',now()+interval '6 minutes',1);`);
  const source = `import sys,json;sys.path.insert(0,'scripts');import intelligence_worker as w;from unittest.mock import patch
payload={'model':w.MODEL,'done':True,'done_reason':'stop','prompt_eval_count':120,'eval_count':90,'total_duration':1000000000,'message':{'content':json.dumps({'concept':'가상 검증 초안','outline':['명시적 합성 입력'],'proposal':'발송하지 않은 가상 제안'})}}
with patch.object(w,'request',return_value=payload): print(json.dumps(w.draft('명시적 합성 입력입니다'),ensure_ascii=False))`;
  const output = JSON.parse(
    execFileSync("python", ["-X", "utf8", "-c", source], { encoding: "utf8" }),
  );
  const worker = localClient(),
    owner = localClient(undefined, localJwt(actor)),
    foreign = localClient(undefined, localJwt(other));
  const heartbeat = await worker.rpc("ops_worker_heartbeat", {
    p_token: token,
    p_id: job,
    p_lease: lease,
  });
  assert.equal(heartbeat.error, null);
  assert.equal(heartbeat.data, true);
  const args = {
    p_token: token,
    p_id: job,
    p_lease: lease,
    p_result: output,
    p_error: null,
    p_elapsed: 1,
  };
  assert.equal(
    (await worker.rpc("ops_worker_finish", { ...args, p_lease: randomUUID() }))
      .data,
    false,
  );
  const finish = await worker.rpc("ops_worker_finish", args);
  assert.equal(finish.error, null);
  assert.equal(finish.data, true);
  const own = await owner.rpc("ops_draft_get", { p_id: job });
  assert.equal(own.error, null);
  assert.equal(own.data.status, "done");
  assert.deepEqual(own.data.output, output);
  assert.equal((await foreign.rpc("ops_draft_get", { p_id: job })).data, null);
  assert.equal((await worker.rpc("ops_worker_finish", args)).data, false);
  assert.equal(sql("select count(*)from public.orders"), original);
  console.log(
    "PASS actual local heartbeat/finish/store/owner read of Python synthetic model output; version/usage preserved, stale and duplicate finish rejected, foreign output absent, ORDERS unchanged",
  );
} finally {
  sql(
    `begin;delete from adme_ops.jobs where id='${job}';delete from adme_ops.rate_windows where subject in('${actor}','${other}');delete from auth.users where id in('${actor}','${other}');update adme_ops.settings set worker_hash=${hash === "NULL" ? "null" : `decode('${hash}','hex')`};update adme_ops.resource_controls set llm_enabled=${enabled === "t"};commit;`,
  );
}
