-- DB owner, read-only:34 application migrations; no feature activation/key required.
select count(*) migration_count from supabase_migrations.schema_migrations;
select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_recommendation'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace
and proname in ('recommendation_create','recommendation_page');
select confdeltype from pg_constraint where conrelid='adme_recommendation.snapshots'::regclass and conname='snapshots_campaign_id_fkey';
-- Expected34, snapshots RLS=true/clientSELECT=false, gateways invoker/volatile, confdeltype=c(cascade).
