import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { localRuntime, localClient, sql } from "./local-qa.mjs";
import { cleanReviewFixtures } from "./review-fixture-cleanup.mjs";
export async function createReviewBrowserCreator() {
  const runtime = localRuntime(),
    client = localClient(runtime.SERVICE_ROLE_KEY),
    nonce = randomUUID(),
    email = `review-qa-${nonce}@example.test`,
    password = randomBytes(24).toString("base64url");
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: "creator", name: "가상 근거 검토 QA" },
  });
  assert.equal(error, null);
  const id = data.user.id,
    creatorId = `user-${id}`;
  sql(
    `insert into public.creators(id,owner_id,published,profile) select '${creatorId}','${id}',true,profile||jsonb_build_object('name','가상 근거 검토 QA') from public.creators where id='creator-001';`,
  );
  return {
    id,
    creatorId,
    email,
    password,
    async cleanup(caseIds) {
      cleanReviewFixtures(caseIds);
      sql(
        `delete from public.creators where id='${creatorId}';delete from adme_ops.rate_windows where subject='${id}';`,
      );
      const r = await client.auth.admin.deleteUser(id);
      assert.equal(r.error, null);
    },
  };
}
export function restoreReviewPolicy(policy) {
  localRuntime();
  const value = (v) =>
    v === null
      ? "null"
      : typeof v === "boolean"
        ? String(v)
        : "'" + v.replaceAll("'", "''") + "'";
  sql(
    `update adme_review.policy set ${[
      "enabled",
      "version",
      "approval_ref",
      "ad_enabled",
      "ad_version",
      "ad_approval_ref",
    ]
      .filter((k) => k in policy)
      .map((k) => `${k}=${value(policy[k])}`)
      .join(",")} where singleton;`,
  );
}
