import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const oldRecruiting = readFileSync(
  "supabase/migrations/20261123100007_campaign_recruiting.sql",
  "utf8",
);
const oldMarketplace = readFileSync(
  "supabase/migrations/20261122115249_youtube_marketplace.sql",
  "utf8",
);
const accepting = oldRecruiting
  .slice(
    oldRecruiting.indexOf("create function public.campaign_accepting("),
    oldRecruiting.indexOf("revoke all on function public.campaign_selected"),
  )
  .replace("create function", "create or replace function");
const board = oldMarketplace
  .slice(
    oldMarketplace.indexOf("create function adme_ops.marketplace_board("),
    oldMarketplace.indexOf("create function public.marketplace_create("),
  )
  .replace("create function", "create or replace function");
const change = readFileSync(
  "supabase/migrations/20261124125948_campaign_recruitment_window.sql",
  "utf8",
);
const snapshot = () =>
  sql(
    `select json_build_object('functions',(select json_agg(json_build_array(oid::text,pg_get_functiondef(oid),proacl::text)order by oid)from pg_proc where oid in('public.campaign_accepting(uuid)'::regprocedure,'adme_ops.marketplace_board(uuid)'::regprocedure,'adme_ops.campaign_accepting_at(public.campaigns,timestamptz)'::regprocedure,'adme_ops.guard_application_window()'::regprocedure)), 'trigger',(select pg_get_triggerdef(oid) from pg_trigger where tgname='campaign_application_window'));`,
  );
const before = snapshot();
const baseline = `begin;drop trigger campaign_application_window on public.proposals;drop function adme_ops.guard_application_window();${accepting}${board}drop function adme_ops.campaign_accepting_at(public.campaigns,timestamptz);`;
sql(`${baseline}\n${change}\nrollback;`);
assert.throws(
  () => sql(`${baseline}\n${change}\nselect 1/0;commit;`),
  /division by zero/,
);
assert.equal(snapshot(), before);
for (const role of ["anon", "authenticated", "service_role"])
  assert.equal(
    sql(
      `select has_function_privilege('${role}','adme_ops.campaign_accepting_at(public.campaigns,timestamptz)','execute')or has_function_privilege('${role}','adme_ops.guard_application_window()','execute')`,
    ),
    "f",
  );
console.log(
  "PASS local120→121 upgrade and fault/rollback preserve definitions/ACL/trigger; private helpers denied",
);
