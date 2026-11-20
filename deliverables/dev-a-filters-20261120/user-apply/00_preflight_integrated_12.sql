-- USER console only. Never force past an unexpected/partial baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or to_regprocedure('public.ops_draft_get(uuid)') is null
     or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null then
    raise exception 'STOP: supported main schema missing; agent must inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007'))<>12
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007'))
     or to_regnamespace('adme_creator') is not null then
    raise exception 'STOP: wrong, partial, unknown or already updated baseline; do not force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected public-invoker/private-implementation boundary missing';
  end if;
end $preflight$;
