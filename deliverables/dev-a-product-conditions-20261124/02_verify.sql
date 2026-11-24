-- Read-only; compare legacy row counts/hashes and existing flags with backup separately.
select count(*)as migrations from supabase_migrations.schema_migrations; --116
select enabled,policy_ref,retention_seconds from adme_product_conditions.controls; --false,NULL,NULL
select active from cron.job where jobname='adme-product-conditions-cleanup'; --true
select has_function_privilege('authenticated','public.product_conditions_create(uuid,text,uuid)','execute'),
has_function_privilege('anon','public.product_conditions_create(uuid,text,uuid)','execute'),
has_function_privilege('authenticated','adme_product_conditions.valid_result(jsonb,adme_product_conditions.requests)','execute'),
has_table_privilege('authenticated','adme_product_conditions.requests','select'); --true,false,false,false
select count(*)as product_operations from adme_ops.jobs where operation='product_conditions_v1'; --0 before activation
