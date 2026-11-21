// Read-only metadata audit in the exact marked loopback QA database.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { localRuntime, sql } from "../tests/support/local-qa.mjs";
localRuntime();
const tables = JSON.parse(
  sql(
    `select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'rls',c.relrowsecurity,'anon_select',has_table_privilege('anon',c.oid,'select'),'authenticated_select',has_table_privilege('authenticated',c.oid,'select'),'service_select',has_table_privilege('service_role',c.oid,'select')) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and(n.nspname='public' or n.nspname like 'adme_%');`,
  ),
);
const functions = JSON.parse(
  sql(
    `select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'schema',n.nspname,'definer',p.prosecdef,'config',p.proconfig,'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'service_execute',has_function_privilege('service_role',p.oid,'execute')) order by n.nspname,p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' or n.nspname like 'adme_%';`,
  ),
);
const buckets = JSON.parse(
  sql(
    `select jsonb_agg(jsonb_build_object('id',id,'public',public,'size',file_size_limit,'mime',allowed_mime_types) order by id) from storage.buckets;`,
  ),
);
const storagePolicies = JSON.parse(
  sql(
    "select jsonb_agg(jsonb_build_object('name',policyname,'roles',roles,'command',cmd,'using',qual,'check',with_check) order by policyname) from pg_policies where schemaname='storage' and tablename='objects';",
  ),
);
assert.ok(tables.length > 20);
assert.ok(tables.every((t) => t.rls));
for (const t of tables.filter((t) =>
  ["adme_upload", "adme_release", "adme_creator"].includes(t.schema),
))
  assert.ok(
    !t.anon_select && !t.authenticated_select,
    t.schema + "." + t.table,
  );
for (const f of functions.filter(
  (f) =>
    f.signature.includes("_legacy_ref(") || f.signature.includes("_legacy("),
))
  assert.ok(
    !f.anon_execute && !f.authenticated_execute && !f.service_execute,
    f.signature,
  );
for (const t of ["creators", "products"])
  assert.equal(
    tables.find((x) => x.schema === "public" && x.table === t)?.rls,
    true,
  );
assert.ok(buckets.every((b) => !b.public));
assert.equal(
  buckets.find((b) => b.id === "adme-private-images")?.size,
  4194304,
);
writeFileSync(
  "harness/evidence/D075/permission-inventory-20261121.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      result: "PASS",
      tables,
      functions,
      buckets,
      storagePolicies,
      scope:
        "Actual local metadata + targeted assertions; role behavior is verified separately by actual REST/Auth/Storage suites. Not a hosted audit.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    result: "PASS",
    tables: tables.length,
    functions: functions.length,
    privateBuckets: buckets.length,
  }),
);
