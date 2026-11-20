-- USER Supabase SQL Editor only. No account/secret values.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
    or to_regprocedure('adme_ops.ops_worker_claim(text)') is null
    or to_regprocedure('public.ops_public_channels(text)') is null
    or to_regprocedure('public.valid_campaign_dto(jsonb)') is null then
    raise exception 'STOP: expected main65063c8 schema baseline is missing; ask agent to inspect';
  end if;
  if to_regclass('public.administrator_grants') is null then
    raise exception 'STOP: wrong baseline variant; do not edit SQL or force apply';
  end if;
  if to_regclass('adme_ops.resource_controls') is not null
    or exists(select 1 from information_schema.columns where table_schema='adme_ops' and table_name='staff' and column_name='approved_at')
    or exists(select 1 from supabase_migrations.schema_migrations where version in ('202611200006','202611200007','202611200008','202611200010')) then
    raise exception 'STOP: new patches already/partially applied; ask agent to inspect';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_public_channels(text)'::regprocedure) then
    raise exception 'STOP: main private-wrapper migration is missing';
  end if;
end $preflight$;
