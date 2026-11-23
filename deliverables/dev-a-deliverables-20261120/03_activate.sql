-- USER only after actual source URL/workflows are verified.
begin;
do $$ begin if (select count(*) from supabase_migrations.schema_migrations)<>31 then raise exception 'STOP: expected31 migrations'; end if; end $$;
select adme_delivery.activate('b0ba55f70db4d6c7bae69f9c133702cd4fc7da9a');
commit;
