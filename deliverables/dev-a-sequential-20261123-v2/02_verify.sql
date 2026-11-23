-- Read-only receipt. No keys/user records.
select count(*)as migration_count from supabase_migrations.schema_migrations; --109
select has_function_privilege('anon','public.youtube_directory_page(jsonb,text,integer)','execute')as directory,
has_function_privilege('anon','public.toggle_saved_creator(text)','execute')as anonymous_save,
has_function_privilege('authenticated','public.serve_promotion_slots(boolean)','execute')as client_hot,
has_function_privilege('service_role','public.serve_promotion_slots(boolean)','execute')as service_hot; --true,false,false,true
select to_regclass('public.saved_creators')is null as retired_table,
(select bool_and(relrowsecurity)from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r'and(n.nspname='public'or n.nspname like 'adme_%'))as all_rls; --true,true
select indexname from pg_indexes where schemaname='adme_ops'and indexname in('youtube_directory_subscribers106','youtube_directory_updated106'); --2
select enabled as test_billing from adme_release.billing_boundary; --must match the user's approved prior state
