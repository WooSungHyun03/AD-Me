// Read-only metadata audit in the exact marked loopback QA database.
import assert from "node:assert/strict";
import { writeFileSync, existsSync } from "node:fs";
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
for (const t of tables.filter(
  (t) =>
    [
      "adme_upload",
      "adme_release",
      "adme_creator",
      "adme_consent",
      "adme_privacy",
    ].includes(t.schema) || t.schema !== "public",
))
  assert.ok(
    !t.anon_select && !t.authenticated_select,
    t.schema + "." + t.table,
  );
for (const f of functions.filter(
  (f) =>
    f.signature.includes("_legacy_ref(") ||
    f.signature.includes("_legacy(") ||
    /_before\d+\(/.test(f.signature),
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
for (const fn of functions.filter((f) => f.definer))
  assert.ok(
    fn.config?.some((value) => value.startsWith("search_path=")),
    `Unpinned definer path: ${fn.signature}`,
  );
for (const role of ["anon", "authenticated"])
  for (const schema of ["public", "extensions"])
    assert.equal(
      sql(`select has_schema_privilege('${role}','${schema}','create');`),
      "f",
      `${role} can shadow objects in ${schema}`,
    );
assert.equal(
  buckets.find((b) => b.id === "adme-private-images")?.size,
  4194304,
);
// D075: anon-callable SECURITY DEFINER functions reviewed 2026-11-25 on main 42e1143.
// Public read DTOs, boolean gates, token-gated worker leases (verify_worker sha256),
// and owner-consented business contacts ("방문자가 볼 수 있도록" consent). New entries need review.
const reviewedAnonDefiners = new Set([
  "adme_consent.current_policy()",
  "adme_creator.catalog_page(text,integer)",
  "adme_creator.filtered_page(jsonb,text,integer,boolean)",
  "adme_creator.home_summary(boolean)",
  "adme_creator.metric_history(text,integer)",
  "adme_creator.normalized_public(text)",
  "adme_creator.public_one(text)",
  "adme_creator.read_boundary_enabled()",
  "adme_ops.creator_youtube_channel(text)",
  "adme_ops.featured_youtube(text,text,integer)",
  "adme_ops.marketplace_board(uuid)",
  "adme_ops.marketplace_visible(uuid)",
  "adme_ops.ops_public_channels(text)",
  "adme_ops.ops_worker_claim(text)",
  "adme_ops.ops_worker_finish(text,uuid,uuid,jsonb,text,integer)",
  "adme_ops.public_youtube_contact(text)",
  "adme_ops.worker_checkpoint(text,uuid,uuid,jsonb,jsonb)",
  "adme_ops.worker_heartbeat(text,uuid,uuid)",
  "adme_ops.youtube_directory_page(jsonb,text,integer)",
  "adme_privacy.enforce_actor()",
  "adme_privacy.request_allowed()",
  "adme_privacy.storage_active(text,text)",
  "adme_release.billing_enabled()",
  "adme_release.demo_catalog_enabled()",
  "adme_review.ad_page(text,text,text,date,date,jsonb,integer)",
  "adme_review.public_records(text,text)",
  "auth_shared_budget(text)",
  "brand_logo_available(uuid)",
  "count_creators(text,text,text,text,numeric,boolean,numeric,numeric,boolean)",
  "deletion_intake_status()",
  "is_admin()",
  "my_role()",
  "search_creators(text,text,text,text,numeric,boolean,numeric,numeric,boolean,text,text,text,integer)",
  "shared_compare(text)",
  "unsubscribe_email(text)",
]);
const unreviewed = functions
  .filter((f) => f.definer && f.anon_execute)
  .map((f) => f.signature)
  .filter((s) => !reviewedAnonDefiners.has(s));
assert.deepEqual(unreviewed, [], "Unreviewed anon SECURITY DEFINER");
// Self role promotion: clients may edit only display fields of their own profile.
for (const column of ["role", "id", "service_email"])
  assert.equal(
    sql(
      `select has_column_privilege('authenticated','public.profiles','${column}','update');`,
    ),
    "f",
    `authenticated can update profiles.${column}`,
  );
writeFileSync(
  (() => {
    const path = process.argv[2];
    assert.ok(
      path &&
        /^harness\/evidence\/[A-Za-z0-9/_-]+\.json$/.test(path) &&
        !existsSync(path),
      "Choose a new evidence snapshot; prior files are immutable",
    );
    return path;
  })(),
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
