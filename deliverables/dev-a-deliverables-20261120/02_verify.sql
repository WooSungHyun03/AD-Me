-- DB owner, read-only:31 application migrations; staging=false is NOT version enforcement.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,release_ref,activated_at from adme_delivery.boundary;
select c.relname,c.relrowsecurity,has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_delivery'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace
and proname in ('delivery_create','delivery_attest','delivery_transition','delivery_page','transition_proposal');
-- All private5 tables RLS/no-client-select; public gateways invoker and volatile.
