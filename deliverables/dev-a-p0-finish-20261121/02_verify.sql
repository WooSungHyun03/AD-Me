-- Read-only after stage, before activation. Expected46 / false / false /0 /false,4194304 / no rows.
select count(*) application_migrations from supabase_migrations.schema_migrations;
select enabled test_billing from adme_release.billing_boundary;
select enabled public_reference_read_switch from adme_creator.reference_boundary;
select count(*) source_publication_policies from adme_creator.publication_policies;
select public,file_size_limit from storage.buckets where id='adme-private-images';
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname in('adme_upload','adme_release','adme_creator') and c.relkind='r' and not c.relrowsecurity;
-- Old read/delivery boundaries may already be active; preserve original activation evidence.
select enabled,release_ref from adme_creator.read_boundary;
select enabled,release_ref from adme_delivery.boundary;
