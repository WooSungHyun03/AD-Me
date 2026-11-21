-- Expected60 / enabled=false / requests0 / quarantine bucket public=false / hook configured.
select count(*)from supabase_migrations.schema_migrations;
select enabled,review_ref from adme_privacy.intake;
select count(*)from adme_privacy.requests;
select id,public from storage.buckets where id='adme-privacy-quarantine';
select cfg.value from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value)where r.rolname='authenticator' and cfg.value like 'pgrst.db_pre_request=%';
select has_function_privilege('authenticated','adme_privacy.actor_active(uuid)','execute') arbitrary_actor_probe; -- false
