-- Read-only:57 / false /0 new requests initially / RLS missing0; prior policy/billing settings preserved.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select enabled,release_ref,activated_at from adme_consent.publication_boundary;
select count(*) from adme_consent.publication_requests;
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='adme_consent' and c.relkind='r' and not c.relrowsecurity;
select version,active from adme_consent.policies;
select enabled test_billing from adme_release.billing_boundary;
