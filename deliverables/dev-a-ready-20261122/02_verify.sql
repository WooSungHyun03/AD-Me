-- Expected67, two private RLS tables, denied direct probes, unchanged intake OFF.
select count(*)from supabase_migrations.schema_migrations;
select enabled from adme_privacy.intake;
select n.nspname,c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select')as app_direct_select from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname,c.relname)in(('adme_review','competitors'),('adme_ops','support_audit'));
select has_function_privilege('authenticated','adme_creator.engagement_value(text)','execute')as private_probe; -- false
select tgname,tgenabled from pg_trigger where tgrelid='adme_ops.support_audit'::regclass and not tgisinternal;
select provider,policy_version,enabled,derived_allowed,history_allowed,history_window_seconds from adme_creator.publication_policies; -- no new approvals
