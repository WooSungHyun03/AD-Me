-- USER only: after exact source 105bbbb73db8c849197db2e9ef950f58dfc4a634 is deployed/coordinated and two-role URL QA + DEV-B review pass.
-- Never enables TEST billing or approves provider/source policy. Owner-only one-way gates.
begin;
set local lock_timeout='5s';
do $$begin if (select count(*) from supabase_migrations.schema_migrations)<>46 then raise exception 'STOP: expected46';end if;end$$;
select adme_creator.activate_read_boundary('105bbbb73db8c849197db2e9ef950f58dfc4a634');
select adme_delivery.activate('105bbbb73db8c849197db2e9ef950f58dfc4a634');
select adme_creator.activate_public_refs('105bbbb73db8c849197db2e9ef950f58dfc4a634');
commit;
