// Synthetic provider consumer of real local claim/heartbeat/finish RPCs. No Ollama calls.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { localRuntime, localClient, sql } from "./local-qa.mjs";
import { syntheticProductOutput } from "./product-condition-fixture.mjs";
export async function completeProductConditionFixture(id) {
  localRuntime();
  const token = randomBytes(32).toString("hex"),
    old = sql(
      "select coalesce(encode(worker_hash,'hex'),'NULL')from adme_ops.settings",
    ),
    worker = localClient();
  const budget = sql(
    "select coalesce(jsonb_agg(to_jsonb(w)),'[]')from adme_ops.rate_windows w where scope='provider_day'and subject='local_llm'",
  );
  try {
    sql(
      `update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8'));delete from adme_ops.rate_windows where scope='provider_day'and subject='local_llm';update adme_ops.jobs set created_at=now()-interval '10 days',available_at=now()where id='${id}';`,
    );
    const claimed = await worker.rpc("ops_worker_claim", { p_token: token });
    assert.equal(claimed.error, null);
    assert.equal(claimed.data?.id, id);
    assert.equal(claimed.data.operation, "product_conditions_v1");
    const job = claimed.data;
    assert.equal(
      (
        await worker.rpc("ops_worker_heartbeat", {
          p_token: token,
          p_id: id,
          p_lease: job.lease,
        })
      ).data,
      true,
    );
    const output = syntheticProductOutput(
      job.productSource,
      job.productSourceVersion,
    );
    if (
      job.productSource.description.includes(
        '음식 <img src="x" onerror="alert(1)">',
      )
    )
      output.suggestions[0].quote = '음식 <img src="x" onerror="alert(1)">';
    const result = await worker.rpc("ops_worker_finish", {
      p_token: token,
      p_id: id,
      p_lease: job.lease,
      p_result: output,
      p_error: null,
      p_elapsed: 1,
    });
    assert.equal(result.error, null);
    assert.equal(result.data, true);
  } finally {
    sql(
      `update adme_ops.settings set worker_hash=${old === "NULL" ? "null" : `decode('${old}','hex')`};delete from adme_ops.rate_windows where scope='provider_day'and subject='local_llm';insert into adme_ops.rate_windows select * from jsonb_populate_recordset(null::adme_ops.rate_windows,'${budget.replaceAll("'", "''")}');`,
    );
  }
}
