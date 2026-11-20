begin;
set local search_path=public,pg_catalog;
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>19
    or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013'))
    or to_regclass('adme_creator.read_boundary') is not null
    or to_regprocedure('public.creator_catalog_page(text,integer)') is not null then
   raise exception 'STOP: unsupported, partial or updated baseline; agent must inspect'; end if;
 if not has_table_privilege('anon','public.creators','select')
    or (select count(*) from pg_policy where polrelid='public.creators'::regclass and polcmd in ('r','*'))<>1
    or not exists(select 1 from pg_policy where polrelid='public.creators'::regclass and polname='creators_read'
      and polroles='{0}'::oid[] and md5(pg_get_expr(polqual,polrelid))='126eaf6938f7be842702b67048e0c867') then
   raise exception 'STOP: custom/hardened read policy must never be reopened by staging'; end if;
 if exists(select 1 from public.creators where length(id) not between 1 and 100)
    or (select count(*) from public.creators where published and moderation_status='allowed')>1000 then
   raise exception 'STOP: legacy IDs or catalog size require a reviewed compatibility/search migration'; end if;
end $gate$;
rollback;
