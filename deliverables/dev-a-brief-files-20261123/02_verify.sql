-- Read-only; no actor records, object paths or keys.
select count(*)as migrations from supabase_migrations.schema_migrations; --112
select enabled,policy_ref is null as pending_policy,retention_days is null as pending_period from adme_brief.controls; --false,true,true after this packet
select count(*)as tables,bool_and(relrowsecurity)as all_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_brief'and c.relkind='r'; --4,true
select public,file_size_limit from storage.buckets where id='adme-campaign-briefs'; --false,4194304
select has_function_privilege('authenticated','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute')as client_write,
has_function_privilege('service_role','public.campaign_brief_change(uuid,uuid,integer,uuid,text,uuid,jsonb)','execute')as server_write,
has_table_privilege('authenticated','adme_brief.files','select')as raw_read; --false,true,false
