-- Read-only; no records or credentials.
select count(*)as migrations from supabase_migrations.schema_migrations; --113
select count(*)as legacy_snapshots from adme_recommendation.snapshots where model_version='adme-1.0'; --same as backup
select has_function_privilege('authenticated','public.recommendation_create_v12(uuid,uuid,boolean)','execute')as actor_create,
has_function_privilege('anon','public.recommendation_page_v12(uuid,uuid,boolean)','execute')as anonymous_read,
has_function_privilege('authenticated','adme_recommendation.context_v12(uuid,boolean)','execute')as helper,
has_table_privilege('authenticated','adme_recommendation.snapshots','select')as raw_read; --true,false,false,false
select enabled,policy_ref,retention_days from adme_brief.controls; --no change; separate U001/D079 gates remain
