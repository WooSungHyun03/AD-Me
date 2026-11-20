-- USER console only. Stop on a wrong/unknown/partial/already-updated baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
    or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null
    or to_regprocedure('public.valid_campaign_dto(jsonb)') is null then
    raise exception 'STOP: supported main schema is missing; ask agent to inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005'))<>8
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005'))
     or to_regprocedure('public.valid_campaign_terms(jsonb)') is not null then
    raise exception 'STOP: wrong, partial, unknown or updated baseline; do not edit/force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected private-schema/public-invoker boundary missing';
  end if;
end $preflight$;
