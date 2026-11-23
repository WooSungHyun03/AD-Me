select count(*)from supabase_migrations.schema_migrations; --68
select relrowsecurity from pg_class where oid='adme_search.saved_conditions'::regclass; --true
select has_schema_privilege('authenticated','adme_search','usage'),has_table_privilege('authenticated','adme_search.saved_conditions','select'),has_function_privilege('anon','public.saved_search_list()','execute'); --all false
select enabled from adme_privacy.intake; --no change
