-- DB owner, read-only. Expected30 migration rows; both publication switches false on first application.
select version,name from supabase_migrations.schema_migrations order by version;
select enabled,version,ad_enabled,ad_version from adme_review.policy;
select c.relname,c.relrowsecurity,has_table_privilege('anon',c.oid,'select') anon_select,
has_table_privilege('authenticated',c.oid,'select') authenticated_select
from pg_class c where c.relnamespace='adme_review'::regnamespace and c.relkind='r';
select proname,prosecdef,provolatile from pg_proc where pronamespace='public'::regnamespace and proname in
('review_submit','review_revise','review_respond','review_decide','review_withdraw','review_inbox','public_review_records');
