// A fixture consumer of the real local lease/finish RPCs, never an actual provider.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { localRuntime, localClient, sql } from "./local-qa.mjs";
export async function finishLocalFixtureJob(kind) {
  if (process.env.ADME_LOCAL_QA !== "1")
    throw new Error("Fixture worker is local QA only");
  localRuntime();
  const token = randomBytes(32).toString("hex");
  sql(
    `update adme_ops.settings set worker_hash=sha256(convert_to('${token}','UTF8')) where singleton=true;`,
  );
  const c = localClient();
  for (let n = 0; n < 10; n++) {
    const { data: job, error } = await c.rpc("ops_worker_claim", {
      p_token: token,
    });
    assert.equal(error, null);
    assert.ok(job, "Expected queued local fixture job");
    const matched = job.kind === kind;
    const output =
      kind === "marketing_draft"
        ? {
            concept: "격리 로컬 계약 검증용 광고 기획입니다.",
            outline: ["가상 사용 장면"],
            proposal: "발송하지 않은 가상 협업 제안입니다.",
            model: "LOCAL CONTRACT FIXTURE (no provider)",
          }
        : { verified: false };
    const reply = await c.rpc("ops_worker_finish", {
      p_token: token,
      p_id: job.id,
      p_lease: job.lease,
      p_result: matched ? output : null,
      p_error: matched ? null : "CHANNEL_UNAVAILABLE",
      p_elapsed: 1,
    });
    assert.equal(reply.error, null);
    assert.equal(reply.data, true);
    if (matched) return;
  }
  throw new Error("Fixture job not found within bounded local queue scan");
}
