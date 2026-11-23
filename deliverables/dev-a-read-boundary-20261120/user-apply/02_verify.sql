-- DB owner, read-only. Expected23 migrations and staging enabled=false.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,activated_at,release_ref from adme_creator.read_boundary;
select has_table_privilege('anon','public.creators','select') as legacy_anon_select;
-- Before activation: true, exactly the old19 behavior. After activation: false.
select proname,prosecdef,provolatile from pg_proc where oid in ('public.creator_catalog_page(text,integer)'::regprocedure,'public.create_creator_proposal(uuid,text,text,text)'::regprocedure);
-- Both security invoker; catalog volatile. Safe public RPC works in either phase.
select jsonb_array_length(public.creator_catalog_page('',1)->'items') as safe_public_sample;
