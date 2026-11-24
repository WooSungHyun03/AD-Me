// D001: verify rollback and injected-failure atomicity on the marked loopback QA DB.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const body = readFileSync(
  "supabase/migrations/20261124074917_test_entitlement_grant_boundary.sql",
  "utf8",
)
  .replace(/^begin;\s*$/im, "")
  .replace(/^commit;\s*$/im, "");
const snapshot = () =>
  sql(
    `select json_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) from pg_proc where oid='public.admin_grant_entitlement(uuid,text,int,int,text)'::regprocedure`,
  );
const before = snapshot();
sql(`begin;\n${body}\nrollback;`);
assert.equal(snapshot(), before);
assert.throws(
  () => sql(`begin;\n${body}\nselect 1/0;\ncommit;`),
  /division by zero/,
);
assert.equal(snapshot(), before);
console.log(
  "PASS D001 migration rollback and injected-failure restore function definition/ACL",
);
