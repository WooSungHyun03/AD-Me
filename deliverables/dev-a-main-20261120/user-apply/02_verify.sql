-- Read-only structural check after application. All control flags should be false.
select version,name from supabase_migrations.schema_migrations
where version in ('202611190004','202611190005','202611190006','202611190007',
 '202611200006','202611200007','202611200008','202611200010') order by version;
select ingestion_enabled,llm_enabled from adme_ops.resource_controls;
select discovery_enabled from adme_ops.settings;
select relname,relrowsecurity from pg_class where oid in
 ('adme_ops.rate_windows'::regclass,'adme_ops.resource_controls'::regclass);
select has_function_privilege('authenticated','adme_ops.provision_staff(uuid,text,text,timestamptz)','execute') as browser_provision,
 has_function_privilege('service_role','adme_ops.take_quota(text,text,int,int,int)','execute') as service_arbitrary_quota;
-- Expected: 8 history rows; flags false/false/false; RLS true/true; privileges false/false.
