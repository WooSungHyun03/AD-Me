-- USER runs only after actual source URL/workflows are verified.
begin;
do $$ begin if (select count(*) from supabase_migrations.schema_migrations)<>23 then raise exception 'STOP: expected23 application migrations'; end if; end $$;
select adme_creator.activate_read_boundary('5cb77a894138b4b46c0a3cdbe1d332cbc51c1cad');
commit;
