import assert from "node:assert/strict";
import { localRuntime, sql } from "./local-qa.mjs";
export function cleanDeliveryFixtures(proposals) {
  localRuntime();
  for (const id of proposals) assert.match(id, /^[a-f0-9-]{36}$/);
  if (!proposals.length) return;
  const ids = proposals.map((id) => `'${id}'`).join(",");
  // Exact disposable local DB only. Locks isolate owner-only fixture deletion;
  // immutable product guards are restored in the same transaction.
  sql(`begin;alter table adme_delivery.submissions disable trigger user;alter table adme_delivery.attestations disable trigger user;alter table adme_delivery.events disable trigger user;
 update adme_delivery.rooms set active_id=null,requested_id=null where proposal_id in (${ids});delete from adme_delivery.events where proposal_id in (${ids});
 delete from adme_delivery.attestations where submission_id in(select id from adme_delivery.submissions where proposal_id in (${ids}));delete from adme_delivery.submissions where proposal_id in (${ids});delete from adme_delivery.rooms where proposal_id in (${ids});
 delete from public.audit_log where entity_id in (${ids});
 alter table adme_delivery.submissions enable trigger user;alter table adme_delivery.attestations enable trigger user;alter table adme_delivery.events enable trigger user;commit;`);
}
