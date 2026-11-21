-- USER only after source 5b94cd78ab1034ee59e1b1aeefb5ff96cc284d6c coordination/review and actual URL validation.
-- Disables legacy publication bypass, not privacy restrictions. No policy approval/provider activation.
begin;
do $$begin if(select count(*) from supabase_migrations.schema_migrations)<>57 then raise exception 'STOP: expected57';end if;end$$;
select adme_consent.activate_publication('5b94cd78ab1034ee59e1b1aeefb5ff96cc284d6c');
commit;
