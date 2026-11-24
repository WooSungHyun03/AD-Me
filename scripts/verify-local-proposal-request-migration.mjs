import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const change =
  readFileSync(
    "supabase/migrations/20261124133155_proposal_transition_requests.sql",
    "utf8",
  ) +
  readFileSync(
    "supabase/migrations/20261124133707_proposal_acceptance_eligibility.sql",
    "utf8",
  );
const snapshot = () =>
  sql(
    `select json_build_object('function',pg_get_functiondef('public.transition_proposal_request(uuid,text,text,uuid)'::regprocedure),'gate',pg_get_functiondef('adme_ops.guard_proposal_acceptance()'::regprocedure),'legacy',pg_get_functiondef('public.transition_proposal(uuid,text)'::regprocedure),'count',(select count(*) from adme_ops.proposal_action_receipts),'acl',(select relacl::text from pg_class where oid='adme_ops.proposal_action_receipts'::regclass));`,
  );
const before = snapshot(),
  baseline =
    "begin;drop trigger proposal_acceptance_eligibility on public.proposals;drop function adme_ops.guard_proposal_acceptance();drop function public.transition_proposal_request(uuid,text,text,uuid);drop table adme_ops.proposal_action_receipts;";
sql(`${baseline}${change}rollback;`);
assert.throws(
  () => sql(`${baseline}${change}select 1/0;commit;`),
  /division by zero/,
);
assert.equal(snapshot(), before);
for (const role of ["anon", "authenticated", "service_role"])
  assert.equal(
    sql(
      `select has_table_privilege('${role}','adme_ops.proposal_action_receipts','select,insert,update,delete')`,
    ),
    "f",
  );
assert.equal(
  sql(
    "select has_function_privilege('anon','public.transition_proposal_request(uuid,text,text,uuid)','execute')",
  ),
  "f",
);
assert.equal(
  sql(
    "select has_function_privilege('authenticated','adme_ops.guard_proposal_acceptance()','execute')",
  ),
  "f",
);
console.log(
  "PASS local121→123 upgrade, fault/rollback preserve legacy function and receipts/ACL; private table/helper and anonymous RPC denied",
);
