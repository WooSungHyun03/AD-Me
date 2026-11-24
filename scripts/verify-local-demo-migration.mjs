import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const body = readFileSync(
  "supabase/migrations/20261124080724_demo_catalog_boundary.sql",
  "utf8",
)
  .replace(/^begin;\s*$/im, "")
  .replace(/^commit;\s*$/im, "");
const snapshot = () =>
  sql(`select json_build_object('boundary',to_regclass('adme_release.catalog_boundary'),
 'functions',(select json_agg(json_build_array(oid::text,pg_get_functiondef(oid),proacl::text)order by oid)from pg_proc where oid in('adme_creator.catalog_dto(public.creators)'::regprocedure,'public.filtered_creators(text,text,text,text,numeric,boolean,numeric,numeric,boolean)'::regprocedure)),
 'policies',(select json_agg(pg_get_expr(polqual,polrelid)order by polname)from pg_policy where polrelid='public.campaigns'::regclass));`);
const before = snapshot();
sql(`begin;\n${body}\nrollback;`);
assert.equal(snapshot(), before);
assert.throws(
  () => sql(`begin;\n${body}\nselect 1/0;\ncommit;`),
  /division by zero/,
);
assert.equal(snapshot(), before);
console.log(
  "PASS D005118→119 rollback/injected failure preserve boundary, function definitions/ACL and campaign policies",
);
