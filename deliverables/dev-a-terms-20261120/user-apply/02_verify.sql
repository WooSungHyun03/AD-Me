-- Read-only. Expected18 application migration rows, both new versions and a validated terms constraint.
select version,name from supabase_migrations.schema_migrations order by version;
select conname,convalidated from pg_constraint where conrelid='public.campaigns'::regclass and conname='campaign_terms_valid';
select p.proname,p.provolatile,p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='ops_draft_get';
-- ops_draft_get: provolatile=v, prosecdef=false. Existing RLS unchanged.
select ingestion_enabled,llm_enabled from adme_ops.resource_controls;
-- From main/integrated: false/false. From955bf8c: pre-existing values preserved, never auto-enabled here.
