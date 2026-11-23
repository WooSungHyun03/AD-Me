-- USER console read/check only. No secrets or personal account fields.
select version,name from supabase_migrations.schema_migrations order by version;
select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' order by c.relname;
do $$ begin
  if to_regclass('public.profiles') is null or to_regclass('public.creators') is null
     or to_regprocedure('public.valid_campaign_dto(jsonb)') is null
     or to_regprocedure('public.moderate_entity(text,text,boolean)') is null then
    raise exception 'STOP: expected core/operations/JSON baseline is missing';
  end if;
  if to_regclass('public.administrator_grants') is not null or to_regclass('public.brand_profiles') is not null
     or exists(select 1 from supabase_migrations.schema_migrations where version in ('202611190004','202611190005','202611190006','202611190007')) then
    raise exception 'STOP: target changes exist; developer must inspect partial/already-applied state';
  end if;
end $$;
