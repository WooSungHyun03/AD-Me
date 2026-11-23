-- Read-only structural check. A USER application result is not pre-filled.
select version,name from supabase_migrations.schema_migrations
where version in ('202611190004','202611190005','202611190006','202611190007') order by version;
select relname,relrowsecurity from pg_class where oid in
('public.administrator_grants'::regclass,'public.moderation_events'::regclass,'public.brand_profiles'::regclass,'public.brand_contacts'::regclass);
select has_function_privilege('anon','public.provision_administrator(uuid,text,timestamptz)','execute') as anon_provision,
has_function_privilege('authenticated','public.provision_administrator(uuid,text,timestamptz)','execute') as member_provision,
has_function_privilege('service_role','public.provision_administrator(uuid,text,timestamptz)','execute') as service_provision;
-- Expected: 4 migration rows, 4 RLS=true rows, and 3 privilege=false values.
