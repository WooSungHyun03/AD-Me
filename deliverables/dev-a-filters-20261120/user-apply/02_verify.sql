-- Read-only. Expected: 19 application migrations; mappings cover every legacy row.
select version,name from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_creator' and c.relkind='r' order by c.relname;
-- Three tables, all RLS true. No fabricated identities or observations are inserted.
select count(*) as missing_legacy_mapping from public.creators c left join adme_creator.records r on r.legacy_creator_id=c.id where r.id is null;
select has_table_privilege('anon','adme_creator.identities','select') as anon_read,
  has_table_privilege('authenticated','adme_creator.identities','insert') as client_write,
  has_table_privilege('service_role','adme_creator.identities','select') as service_read,
  has_function_privilege('anon','public.my_creator_identity_snapshot()','execute') as anon_rpc;
-- All false. Snapshot wrapper must be security invoker; only authenticated owner can read own snapshot.
select prosecdef from pg_proc where oid='public.my_creator_identity_snapshot()'::regprocedure;
