-- Read-only expected54 / false /0 /false /false. Stage is not policy/security completion.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select active,review_ref,approved_at from adme_consent.policies;
select count(*) source_runtime_policies from adme_ops.source_runtime_policies;
select enabled consent_boundary from adme_consent.boundary;
select enabled test_billing from adme_release.billing_boundary;
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('adme_consent','adme_ops') and c.relkind='r' and not c.relrowsecurity;
-- Expected last query0 rows. Do not approve the draft policy or copy fictional QA approvals.
