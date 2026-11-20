-- USER console only. Stop on a wrong/unknown/partial/already-updated baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
    or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null
    or to_regprocedure('public.valid_campaign_dto(jsonb)') is null then
    raise exception 'STOP: supported main schema is missing; ask agent to inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010'))<>16
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010'))
     or to_regprocedure('public.valid_campaign_terms(jsonb)') is not null then
    raise exception 'STOP: wrong, partial, unknown or updated baseline; do not edit/force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected private-schema/public-invoker boundary missing';
  end if;
end $preflight$;

-- Source SHA-256: 318a327824a503c95bfb3d9d093f2d1fd4c498fa5eddf2b8e1b4c9b591efb80b
-- D076: the protected operation, not a separate optional RPC, owns its quota.
begin;
create or replace function adme_ops.ops_draft_get(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  -- Separate from legacy draft_poll so old app versions do not double-charge.
  perform adme_ops.require_quota('draft_read',auth.uid()::text,120,60);
  return (select jsonb_build_object('status',status,'output',output,'error',error_code)
    from adme_ops.jobs where id=p_id and kind='marketing_draft' and owner_id=auth.uid());
end;
$$;
create or replace function public.ops_draft_get(p_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select adme_ops.ops_draft_get($1); $$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200011','draft_read_limits',array[$adme_packet_body$-- D076: the protected operation, not a separate optional RPC, owns its quota.
begin;
create or replace function adme_ops.ops_draft_get(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  -- Separate from legacy draft_poll so old app versions do not double-charge.
  perform adme_ops.require_quota('draft_read',auth.uid()::text,120,60);
  return (select jsonb_build_object('status',status,'output',output,'error',error_code)
    from adme_ops.jobs where id=p_id and kind='marketing_draft' and owner_id=auth.uid());
end;
$$;
create or replace function public.ops_draft_get(p_id uuid) returns jsonb
language sql volatile security invoker set search_path='' as $$ select adme_ops.ops_draft_get($1); $$;
commit;
$adme_packet_body$]);
commit;

-- Source SHA-256: 97693e96a7cab894f6d2cf5c80c135c93b97d0f26c7c2e2f6b397d0a8b346091
-- D041: optional additive v2 terms; legacy briefs and their total budget stay intact.
begin;
create function public.valid_campaign_terms(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare phase text; w jsonb; s timestamptz; e timestamptz; starts timestamptz[]:='{}'; c jsonb; d jsonb; v numeric;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>131072
    or p->'version' is distinct from '2'::jsonb or p-ARRAY['version','recruitment','production','posting','compensation','deliverables']<>'{}'::jsonb then return false; end if;
  foreach phase in array ARRAY['recruitment','production','posting'] loop
    w:=p->phase;
    if jsonb_typeof(w) is distinct from 'object' or w-ARRAY['start','end']<>'{}'::jsonb then return false; end if;
    if jsonb_typeof(w->'start') is distinct from 'string' or jsonb_typeof(w->'end') is distinct from 'string'
      or (w->>'start') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$'
      or (w->>'end') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$' then return false; end if;
    s:=(w->>'start')::timestamptz; e:=(w->>'end')::timestamptz;
    if s>=e then return false; end if;
    starts:=array_append(starts,s);
  end loop;
  if starts[1]>starts[2] or starts[2]>starts[3] then return false; end if;
  c:=p->'compensation';
  if jsonb_typeof(c) is distinct from 'object' then return false; end if;
  if c->>'mode'='unknown' then
    if c<>'{"mode":"unknown"}'::jsonb then return false; end if;
  elsif c->>'mode'='declared' then
    if c-ARRAY['mode','cash','product']<>'{}'::jsonb or not(c?'cash' or c?'product') then return false; end if;
    if c?'cash' then
      d:=c->'cash';
      if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['minimumKrw','maximumKrw']<>'{}'::jsonb
        or jsonb_typeof(d->'minimumKrw') is distinct from 'number' or jsonb_typeof(d->'maximumKrw') is distinct from 'number' then return false; end if;
      if (d->>'minimumKrw')::numeric not between 0 and 100000000
        or (d->>'maximumKrw')::numeric not between (d->>'minimumKrw')::numeric and 100000000
        or trunc((d->>'minimumKrw')::numeric)<>(d->>'minimumKrw')::numeric
        or trunc((d->>'maximumKrw')::numeric)<>(d->>'maximumKrw')::numeric then return false; end if;
    end if;
    if c?'product' then
      d:=c->'product';
      if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['description','quantity']<>'{}'::jsonb
        or jsonb_typeof(d->'description') is distinct from 'string' or length(regexp_replace(d->>'description','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 300
        or jsonb_typeof(d->'quantity') is distinct from 'number' then return false; end if;
      v:=(d->>'quantity')::numeric;
      if v not between 1 and 1000 or trunc(v)<>v then return false; end if;
    end if;
  else return false; end if;
  if jsonb_typeof(p->'deliverables') is distinct from 'array' or jsonb_array_length(p->'deliverables') not between 1 and 20 then return false; end if;
  for d in select value from jsonb_array_elements(p->'deliverables') loop
    if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['format','quantity','usageRights','exclusivity']<>'{}'::jsonb
      or jsonb_typeof(d->'format') is distinct from 'string' or length(regexp_replace(d->>'format','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 80
      or jsonb_typeof(d->'usageRights') is distinct from 'string' or length(regexp_replace(d->>'usageRights','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 500
      or jsonb_typeof(d->'quantity') is distinct from 'number' or not(d?'exclusivity') then return false; end if;
    v:=(d->>'quantity')::numeric;
    if v not between 1 and 100 or trunc(v)<>v then return false; end if;
    if jsonb_typeof(d->'exclusivity') is distinct from 'null' and
      (jsonb_typeof(d->'exclusivity') is distinct from 'string' or length(regexp_replace(d->>'exclusivity','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 500) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_campaign_terms(jsonb) from public,anon;
grant execute on function public.valid_campaign_terms(jsonb) to authenticated,service_role;
alter table public.campaigns add constraint campaign_terms_valid
  check(not(brief?'terms') or public.valid_campaign_terms(brief->'terms')) not valid;
alter table public.campaigns validate constraint campaign_terms_valid;
create function public.preserve_campaign_terms() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.brief?'terms' and not(new.brief?'terms') then
    raise exception 'structured campaign terms cannot be silently removed' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_campaign_terms() from public,anon,authenticated;
create trigger campaign_terms_preserved before update of brief on public.campaigns
for each row execute function public.preserve_campaign_terms();
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200012','campaign_terms',array[$adme_packet_body$-- D041: optional additive v2 terms; legacy briefs and their total budget stay intact.
begin;
create function public.valid_campaign_terms(p jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare phase text; w jsonb; s timestamptz; e timestamptz; starts timestamptz[]:='{}'; c jsonb; d jsonb; v numeric;
begin
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>131072
    or p->'version' is distinct from '2'::jsonb or p-ARRAY['version','recruitment','production','posting','compensation','deliverables']<>'{}'::jsonb then return false; end if;
  foreach phase in array ARRAY['recruitment','production','posting'] loop
    w:=p->phase;
    if jsonb_typeof(w) is distinct from 'object' or w-ARRAY['start','end']<>'{}'::jsonb then return false; end if;
    if jsonb_typeof(w->'start') is distinct from 'string' or jsonb_typeof(w->'end') is distinct from 'string'
      or (w->>'start') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$'
      or (w->>'end') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:00[.]000Z$' then return false; end if;
    s:=(w->>'start')::timestamptz; e:=(w->>'end')::timestamptz;
    if s>=e then return false; end if;
    starts:=array_append(starts,s);
  end loop;
  if starts[1]>starts[2] or starts[2]>starts[3] then return false; end if;
  c:=p->'compensation';
  if jsonb_typeof(c) is distinct from 'object' then return false; end if;
  if c->>'mode'='unknown' then
    if c<>'{"mode":"unknown"}'::jsonb then return false; end if;
  elsif c->>'mode'='declared' then
    if c-ARRAY['mode','cash','product']<>'{}'::jsonb or not(c?'cash' or c?'product') then return false; end if;
    if c?'cash' then
      d:=c->'cash';
      if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['minimumKrw','maximumKrw']<>'{}'::jsonb
        or jsonb_typeof(d->'minimumKrw') is distinct from 'number' or jsonb_typeof(d->'maximumKrw') is distinct from 'number' then return false; end if;
      if (d->>'minimumKrw')::numeric not between 0 and 100000000
        or (d->>'maximumKrw')::numeric not between (d->>'minimumKrw')::numeric and 100000000
        or trunc((d->>'minimumKrw')::numeric)<>(d->>'minimumKrw')::numeric
        or trunc((d->>'maximumKrw')::numeric)<>(d->>'maximumKrw')::numeric then return false; end if;
    end if;
    if c?'product' then
      d:=c->'product';
      if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['description','quantity']<>'{}'::jsonb
        or jsonb_typeof(d->'description') is distinct from 'string' or length(regexp_replace(d->>'description','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 300
        or jsonb_typeof(d->'quantity') is distinct from 'number' then return false; end if;
      v:=(d->>'quantity')::numeric;
      if v not between 1 and 1000 or trunc(v)<>v then return false; end if;
    end if;
  else return false; end if;
  if jsonb_typeof(p->'deliverables') is distinct from 'array' or jsonb_array_length(p->'deliverables') not between 1 and 20 then return false; end if;
  for d in select value from jsonb_array_elements(p->'deliverables') loop
    if jsonb_typeof(d) is distinct from 'object' or d-ARRAY['format','quantity','usageRights','exclusivity']<>'{}'::jsonb
      or jsonb_typeof(d->'format') is distinct from 'string' or length(regexp_replace(d->>'format','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 80
      or jsonb_typeof(d->'usageRights') is distinct from 'string' or length(regexp_replace(d->>'usageRights','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 500
      or jsonb_typeof(d->'quantity') is distinct from 'number' or not(d?'exclusivity') then return false; end if;
    v:=(d->>'quantity')::numeric;
    if v not between 1 and 100 or trunc(v)<>v then return false; end if;
    if jsonb_typeof(d->'exclusivity') is distinct from 'null' and
      (jsonb_typeof(d->'exclusivity') is distinct from 'string' or length(regexp_replace(d->>'exclusivity','^[[:space:]]+|[[:space:]]+$','','g')) not between 1 and 500) then return false; end if;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.valid_campaign_terms(jsonb) from public,anon;
grant execute on function public.valid_campaign_terms(jsonb) to authenticated,service_role;
alter table public.campaigns add constraint campaign_terms_valid
  check(not(brief?'terms') or public.valid_campaign_terms(brief->'terms')) not valid;
alter table public.campaigns validate constraint campaign_terms_valid;
create function public.preserve_campaign_terms() returns trigger
language plpgsql set search_path='' as $$
begin
  if old.brief?'terms' and not(new.brief?'terms') then
    raise exception 'structured campaign terms cannot be silently removed' using errcode='22023';
  end if;
  return new;
end;
$$;
revoke all on function public.preserve_campaign_terms() from public,anon,authenticated;
create trigger campaign_terms_preserved before update of brief on public.campaigns
for each row execute function public.preserve_campaign_terms();
commit;
$adme_packet_body$]);
commit;
