import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const old = readFileSync("supabase/migrations/20261123100012_privacy_exports.sql", "utf8");
const previous = old.slice(old.indexOf("create function public.create_privacy_export()"), old.indexOf("-- Returns 'ok'"))
  .replace("create function", "create or replace function");
const change = readFileSync("supabase/migrations/20261124124402_privacy_session_reauthentication.sql", "utf8");
const before = sql("select pg_get_functiondef('public.create_privacy_export()'::regprocedure)||pg_get_functiondef('adme_privacy.session_reauthenticated()'::regprocedure)");
const baseline = `begin; drop function adme_privacy.session_reauthenticated(); ${previous}`;
sql(`${baseline}\n${change}\nrollback;`);
assert.throws(() => sql(`${baseline}\n${change}\nselect 1/0; commit;`), /division by zero/);
assert.equal(sql("select pg_get_functiondef('public.create_privacy_export()'::regprocedure)||pg_get_functiondef('adme_privacy.session_reauthenticated()'::regprocedure)"), before);
assert.equal(sql("select has_function_privilege('anon','adme_privacy.session_reauthenticated()','execute') or has_function_privilege('authenticated','adme_privacy.session_reauthenticated()','execute') or has_function_privilege('service_role','adme_privacy.session_reauthenticated()','execute')"), "f");
console.log("PASS local119→120 and injected failure/rollback preserve definitions; private helper ACL denied");
