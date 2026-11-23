import assert from "node:assert/strict";
import { localRuntime, sql } from "./local-qa.mjs";
export function cleanReviewFixtures(ids) {
  localRuntime();
  for (const id of ids) assert.match(id, /^[a-f0-9-]{36}$/);
  if (!ids.length) return;
  const list = ids.map((id) => `'${id}'`).join(",");
  // Owner-only cleanup in the exact local disposable DB. ALTER locks exclude
  // concurrent writes; only listed fictional fixtures are deleted, then guards restore.
  sql(`begin; alter table adme_review.revisions disable trigger user; alter table adme_review.decisions disable trigger user; alter table adme_review.responses disable trigger user;
    delete from adme_review.decisions where case_id in (${list}); delete from adme_review.responses where case_id in (${list}); delete from adme_review.revisions where case_id in (${list}); delete from adme_review.cases where id in (${list});
    alter table adme_review.revisions enable trigger user; alter table adme_review.decisions enable trigger user; alter table adme_review.responses enable trigger user; commit;
    delete from public.audit_log where entity_id in (${list});`);
}
