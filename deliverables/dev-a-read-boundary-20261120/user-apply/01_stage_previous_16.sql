-- USER console only. Never force past an unexpected/partial baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or to_regprocedure('public.ops_draft_get(uuid)') is null
     or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null then
    raise exception 'STOP: supported main schema missing; agent must inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010'))<>16
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010'))
     or to_regnamespace('adme_creator') is not null then
    raise exception 'STOP: wrong, partial, unknown or already updated baseline; do not force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected public-invoker/private-implementation boundary missing';
  end if;
end $preflight$;

-- Source SHA-256 (UTF-8, LF): 318a327824a503c95bfb3d9d093f2d1fd4c498fa5eddf2b8e1b4c9b591efb80b
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200011','draft_read_limits',array[$adme_schema_packet$-- D076: the protected operation, not a separate optional RPC, owns its quota.
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
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 85c5e16ce63d0c359c71e48c485f7323fd38ccdec627106959749bd1fad06eca
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200012','campaign_terms',array[$adme_schema_packet$-- D041: optional additive v2 terms; legacy briefs and their total budget stay intact.
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
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 4f83186fdb220a6723ee85bd5035e635644aa6aa6f7f31265f222a95589c0ca1
-- D018 stage 1: additive private storage; no provider approval or public read switch.
begin;
create schema adme_creator;
revoke all on schema adme_creator from public, anon, authenticated, service_role;
grant usage on schema adme_creator to authenticated;
alter default privileges in schema adme_creator revoke execute on functions from public;

create table adme_creator.records (
  id uuid primary key default gen_random_uuid(),
  legacy_creator_id text not null unique references public.creators(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table adme_creator.identities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references adme_creator.records(id) on delete cascade,
  provider text not null check (provider in ('youtube','instagram','tiktok','approved_web')),
  external_id text not null check (length(btrim(external_id)) between 1 and 256 and external_id=btrim(external_id)),
  handle text check (length(btrim(handle)) between 1 and 160),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  canonical_url text not null check (length(canonical_url)<=2000 and canonical_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'),
  observed_at timestamptz not null check (isfinite(observed_at)),
  collected_at timestamptz not null default now() check (isfinite(collected_at)),
  source_type text not null check (source_type in ('official_api','owner_submission','approved_web','synthetic_demo')),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 80),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed','pending','claimed')),
  owner_consent boolean not null default false,
  publication_status text not null default 'private' check (publication_status in ('private','published')),
  moderation_status text not null default 'allowed' check (moderation_status in ('allowed','restricted')),
  unique(provider,external_id),
  check (publication_status<>'published' or (claim_status='claimed' and owner_consent and moderation_status='allowed'))
);
create index on adme_creator.identities(creator_id,id);
create table adme_creator.metric_observations (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references adme_creator.identities(id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,79}$'),
  value double precision check (value>=0 and value<'Infinity'::double precision),
  unit text not null check (unit in ('count','percent','ratio')),
  observed_at timestamptz not null check (isfinite(observed_at)),
  collected_at timestamptz not null default now() check (isfinite(collected_at)),
  source_url text not null check (length(source_url)<=2000 and source_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 80),
  kind text not null check (kind in ('original','derived')),
  unique(identity_id,name,observed_at,policy_version,kind),
  check (value is null or unit<>'percent' or value<=100),
  check (value is null or unit<>'count' or (value=trunc(value) and value<=9007199254740991))
);
create index on adme_creator.metric_observations(identity_id,observed_at desc,id);
alter table adme_creator.records enable row level security;
alter table adme_creator.identities enable row level security;
alter table adme_creator.metric_observations enable row level security;
-- Default deny: even service_role gets no table privileges. Only the DB owner
-- stages writes until D017/D019 policy checks and worker integration are reviewed.
revoke all on all tables in schema adme_creator from public,anon,authenticated,service_role;

insert into adme_creator.records(legacy_creator_id) select id from public.creators;
-- Intentionally no identities or metrics backfilled from handles/fictional JSON.
create function adme_creator.sync_legacy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into adme_creator.records(legacy_creator_id) values(new.id) on conflict(legacy_creator_id) do nothing;
  if TG_OP='UPDATE' and new.profile->'is_demo' is distinct from old.profile->'is_demo'
    and exists(select 1 from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id where r.legacy_creator_id=new.id) then
    raise exception 'existing identity provenance cannot be reclassified' using errcode='23514';
  end if;
  if TG_OP='UPDATE' and new.owner_id is distinct from old.owner_id then
    update adme_creator.identities set claim_status='unclaimed',owner_consent=false,publication_status='private'
      where creator_id=(select r.id from adme_creator.records r where r.legacy_creator_id=new.id);
  end if;
  return new;
end;
$$;
revoke all on function adme_creator.sync_legacy() from public,anon,authenticated,service_role;
create trigger creator_identity_legacy_sync after insert or update of owner_id,profile on public.creators
for each row execute function adme_creator.sync_legacy();

create function adme_creator.guard_identity() returns trigger
language plpgsql set search_path='' as $$
declare legacy public.creators;
begin
  select c.* into strict legacy from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id where r.id=new.creator_id for update of c;
  if new.claim_status='claimed' and legacy.owner_id is null then
    raise exception 'claim requires an owner' using errcode='23514';
  end if;
  if (new.source_type='synthetic_demo') is distinct from (legacy.profile->'is_demo'='true'::jsonb) then
    raise exception 'source must agree with explicit demo provenance' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function adme_creator.guard_identity() from public,anon,authenticated,service_role;
create trigger creator_identity_guard before insert or update on adme_creator.identities
for each row execute function adme_creator.guard_identity();

create function adme_creator.my_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select jsonb_build_object('version',1,'creatorId',r.id,'legacyCreatorId',c.id,'legacyProfile',c.profile,
    'identities',coalesce((select jsonb_agg(jsonb_build_object(
      'identity',jsonb_build_object('id',i.id,'provider',i.provider,'externalId',i.external_id,'handle',i.handle,
        'displayName',i.display_name,'canonicalUrl',i.canonical_url,'observedAt',i.observed_at,
        'claimStatus',i.claim_status,'ownerId',c.owner_id,'ownerConsent',i.owner_consent,
        'publicationStatus',case when c.published and c.moderation_status='allowed' then i.publication_status else 'private' end,
        'moderationStatus',case when c.moderation_status='restricted' then 'restricted' else i.moderation_status end,
        'isDemo',c.profile->'is_demo'),
      'sourceType',i.source_type,'policyVersion',i.policy_version,'collectedAt',i.collected_at,
      'metrics',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',m.value,'unit',m.unit,
        'observedAt',m.observed_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind)
        order by m.observed_at desc,m.id) from (select * from adme_creator.metric_observations m
          where m.identity_id=i.id order by m.observed_at desc,m.id limit 200) m),'[]'::jsonb),
      'metricsTruncated',(select count(*)>200 from adme_creator.metric_observations m where m.identity_id=i.id)
    ) order by i.id) from (select * from adme_creator.identities i where i.creator_id=r.id order by i.id limit 50) i),'[]'::jsonb),
    'identitiesTruncated',(select count(*)>50 from adme_creator.identities i where i.creator_id=r.id)) into result
    from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id where c.owner_id=auth.uid();
  return result;
end;
$$;
revoke all on function adme_creator.my_snapshot() from public,anon,authenticated,service_role;
grant execute on function adme_creator.my_snapshot() to authenticated;
create function public.my_creator_identity_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.my_snapshot(); $$;
revoke all on function public.my_creator_identity_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.my_creator_identity_snapshot() to authenticated;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200013','creator_identity',array[$adme_schema_packet$-- D018 stage 1: additive private storage; no provider approval or public read switch.
begin;
create schema adme_creator;
revoke all on schema adme_creator from public, anon, authenticated, service_role;
grant usage on schema adme_creator to authenticated;
alter default privileges in schema adme_creator revoke execute on functions from public;

create table adme_creator.records (
  id uuid primary key default gen_random_uuid(),
  legacy_creator_id text not null unique references public.creators(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table adme_creator.identities (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references adme_creator.records(id) on delete cascade,
  provider text not null check (provider in ('youtube','instagram','tiktok','approved_web')),
  external_id text not null check (length(btrim(external_id)) between 1 and 256 and external_id=btrim(external_id)),
  handle text check (length(btrim(handle)) between 1 and 160),
  display_name text not null check (length(btrim(display_name)) between 1 and 160),
  canonical_url text not null check (length(canonical_url)<=2000 and canonical_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'),
  observed_at timestamptz not null check (isfinite(observed_at)),
  collected_at timestamptz not null default now() check (isfinite(collected_at)),
  source_type text not null check (source_type in ('official_api','owner_submission','approved_web','synthetic_demo')),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 80),
  claim_status text not null default 'unclaimed' check (claim_status in ('unclaimed','pending','claimed')),
  owner_consent boolean not null default false,
  publication_status text not null default 'private' check (publication_status in ('private','published')),
  moderation_status text not null default 'allowed' check (moderation_status in ('allowed','restricted')),
  unique(provider,external_id),
  check (publication_status<>'published' or (claim_status='claimed' and owner_consent and moderation_status='allowed'))
);
create index on adme_creator.identities(creator_id,id);
create table adme_creator.metric_observations (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references adme_creator.identities(id) on delete cascade,
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,79}$'),
  value double precision check (value>=0 and value<'Infinity'::double precision),
  unit text not null check (unit in ('count','percent','ratio')),
  observed_at timestamptz not null check (isfinite(observed_at)),
  collected_at timestamptz not null default now() check (isfinite(collected_at)),
  source_url text not null check (length(source_url)<=2000 and source_url ~ '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$'),
  policy_version text not null check (length(btrim(policy_version)) between 1 and 80),
  kind text not null check (kind in ('original','derived')),
  unique(identity_id,name,observed_at,policy_version,kind),
  check (value is null or unit<>'percent' or value<=100),
  check (value is null or unit<>'count' or (value=trunc(value) and value<=9007199254740991))
);
create index on adme_creator.metric_observations(identity_id,observed_at desc,id);
alter table adme_creator.records enable row level security;
alter table adme_creator.identities enable row level security;
alter table adme_creator.metric_observations enable row level security;
-- Default deny: even service_role gets no table privileges. Only the DB owner
-- stages writes until D017/D019 policy checks and worker integration are reviewed.
revoke all on all tables in schema adme_creator from public,anon,authenticated,service_role;

insert into adme_creator.records(legacy_creator_id) select id from public.creators;
-- Intentionally no identities or metrics backfilled from handles/fictional JSON.
create function adme_creator.sync_legacy() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into adme_creator.records(legacy_creator_id) values(new.id) on conflict(legacy_creator_id) do nothing;
  if TG_OP='UPDATE' and new.profile->'is_demo' is distinct from old.profile->'is_demo'
    and exists(select 1 from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id where r.legacy_creator_id=new.id) then
    raise exception 'existing identity provenance cannot be reclassified' using errcode='23514';
  end if;
  if TG_OP='UPDATE' and new.owner_id is distinct from old.owner_id then
    update adme_creator.identities set claim_status='unclaimed',owner_consent=false,publication_status='private'
      where creator_id=(select r.id from adme_creator.records r where r.legacy_creator_id=new.id);
  end if;
  return new;
end;
$$;
revoke all on function adme_creator.sync_legacy() from public,anon,authenticated,service_role;
create trigger creator_identity_legacy_sync after insert or update of owner_id,profile on public.creators
for each row execute function adme_creator.sync_legacy();

create function adme_creator.guard_identity() returns trigger
language plpgsql set search_path='' as $$
declare legacy public.creators;
begin
  select c.* into strict legacy from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id where r.id=new.creator_id for update of c;
  if new.claim_status='claimed' and legacy.owner_id is null then
    raise exception 'claim requires an owner' using errcode='23514';
  end if;
  if (new.source_type='synthetic_demo') is distinct from (legacy.profile->'is_demo'='true'::jsonb) then
    raise exception 'source must agree with explicit demo provenance' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function adme_creator.guard_identity() from public,anon,authenticated,service_role;
create trigger creator_identity_guard before insert or update on adme_creator.identities
for each row execute function adme_creator.guard_identity();

create function adme_creator.my_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select jsonb_build_object('version',1,'creatorId',r.id,'legacyCreatorId',c.id,'legacyProfile',c.profile,
    'identities',coalesce((select jsonb_agg(jsonb_build_object(
      'identity',jsonb_build_object('id',i.id,'provider',i.provider,'externalId',i.external_id,'handle',i.handle,
        'displayName',i.display_name,'canonicalUrl',i.canonical_url,'observedAt',i.observed_at,
        'claimStatus',i.claim_status,'ownerId',c.owner_id,'ownerConsent',i.owner_consent,
        'publicationStatus',case when c.published and c.moderation_status='allowed' then i.publication_status else 'private' end,
        'moderationStatus',case when c.moderation_status='restricted' then 'restricted' else i.moderation_status end,
        'isDemo',c.profile->'is_demo'),
      'sourceType',i.source_type,'policyVersion',i.policy_version,'collectedAt',i.collected_at,
      'metrics',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',m.value,'unit',m.unit,
        'observedAt',m.observed_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind)
        order by m.observed_at desc,m.id) from (select * from adme_creator.metric_observations m
          where m.identity_id=i.id order by m.observed_at desc,m.id limit 200) m),'[]'::jsonb),
      'metricsTruncated',(select count(*)>200 from adme_creator.metric_observations m where m.identity_id=i.id)
    ) order by i.id) from (select * from adme_creator.identities i where i.creator_id=r.id order by i.id limit 50) i),'[]'::jsonb),
    'identitiesTruncated',(select count(*)>50 from adme_creator.identities i where i.creator_id=r.id)) into result
    from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id where c.owner_id=auth.uid();
  return result;
end;
$$;
revoke all on function adme_creator.my_snapshot() from public,anon,authenticated,service_role;
grant execute on function adme_creator.my_snapshot() to authenticated;
create function public.my_creator_identity_snapshot() returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.my_snapshot(); $$;
revoke all on function public.my_creator_identity_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.my_creator_identity_snapshot() to authenticated;
commit;
$adme_schema_packet$]);
commit;

begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtext('adme-creator-boundary'));
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
set local adme.creator_boundary_staging='on';
-- D075/D018: preserve legacy IDs and private workflows while closing raw public reads.

create function adme_creator.public_https(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare authority text; port_value text;
begin
  if p_value is null or length(p_value)>2000 or
    p_value !~ '^https://([^@/:?#[:space:]\\]+|\[[A-Fa-f0-9:.]+\])(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$' then return null; end if;
  authority:=substring(p_value from '^https://([^/?#]+)');
  port_value:=substring(authority from ':([0-9]{1,5})$');
  if port_value is not null and port_value::int>65535 then return null; end if;
  return p_value;
end;
$$;
create function adme_creator.public_social(p_value text) returns text
language sql immutable set search_path='' as $$
  select case when adme_creator.public_https(p_value) is not null and (
    p_value ~ '^https://www\.youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}|channel/UC[A-Za-z0-9_-]{22}|@[A-Za-z0-9_.%~-]+)$'
    or p_value ~ '^https://www\.instagram\.com/([A-Za-z0-9_.]{1,30}|(p|reel)/[A-Za-z0-9_-]{1,32})/$'
    or p_value ~ '^https://www\.tiktok\.com/@[A-Za-z0-9_.]{1,24}(/video/[0-9]{1,25})?$'
  ) then p_value else null end;
$$;
create function adme_creator.catalog_dto(p_row public.creators) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb:=p_row.profile; social text; portfolio text; synthetic boolean; field_name text;
begin
  if not p_row.published or p_row.moderation_status<>'allowed' or not public.valid_creator_dto(p) then return null; end if;
  foreach field_name in array array['categories','vibes','formats','platforms'] loop
    if exists(select 1 from jsonb_array_elements_text(p->field_name) v where length(v)>50) then return null; end if;
  end loop;
  if (p->>'price_min_krw')::numeric<>trunc((p->>'price_min_krw')::numeric)
    or (p->>'price_max_krw')::numeric<>trunc((p->>'price_max_krw')::numeric) then return null; end if;
  synthetic:=p->'is_demo'='true'::jsonb and p->>'metrics_source'='synthetic_demo_not_verified';
  if synthetic and (p->>'followers')::numeric<>trunc((p->>'followers')::numeric) then return null; end if;
  if p->'owner_consent'='true'::jsonb then
    social:=adme_creator.public_social(p->>'social_url');
    portfolio:=adme_creator.public_https(p->>'portfolio_url');
  end if;
  return jsonb_build_object('seed_id',p_row.id,'name',p->'name','handle',p->'handle','bio',p->'bio',
    'categories',p->'categories','vibes',p->'vibes','formats',p->'formats','platforms',p->'platforms',
    'price_min_krw',p->'price_min_krw','price_max_krw',p->'price_max_krw',
    'followers',case when synthetic then p->'followers' else 'null'::jsonb end,
    'metrics_source',case when synthetic then 'synthetic_demo_not_verified' else 'unavailable' end,
    'is_available',p->'is_available','is_demo',p->'is_demo',
    'data_source',case when p->'is_demo'='true'::jsonb then 'generated fictional test fixture' else 'owner_registration' end,
    'source_url',social,'portrait_asset',null,'image_placeholder',case when p->'is_demo'='true'::jsonb then 'gradient_initials' else 'initials' end,
    'published',true) || case when social is null then '{}'::jsonb else jsonb_build_object('social_url',social) end
    || case when portfolio is null then '{}'::jsonb else jsonb_build_object('portfolio_url',portfolio) end;
end;
$$;
revoke all on function adme_creator.public_https(text),adme_creator.public_social(text),adme_creator.catalog_dto(public.creators) from public,anon,authenticated,service_role;

-- The present UI still filters a bounded snapshot. This cursor is compatibility
-- pagination, not D033's completed indexed server search/filter API.
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  with source as (
    select c.id,adme_creator.catalog_dto(c) dto from public.creators c
    where c.published and c.moderation_status='allowed' and c.id collate "C">p_after collate "C"
      and adme_creator.catalog_dto(c) is not null order by c.id collate "C" limit p_limit+1
  ), numbered as (select *,row_number() over(order by id collate "C") n from source)
  select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(dto order by id collate "C") filter(where n<=p_limit),'[]'::jsonb),
    'nextCursor',case when count(*)>p_limit then max(id collate "C") filter(where n<=p_limit) else null end) into result from numbered;
  return result;
end;
$$;
create function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
grant usage on schema adme_creator to anon;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;

create function adme_creator.saved_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('creator_id',s.creator_id,'creator',adme_creator.catalog_dto(c)) order by s.creator_id collate "C")
    from public.saved_creators s join public.creators c on c.id=s.creator_id where s.owner_id=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.my_saved_creator_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.saved_catalog(); $$;
revoke all on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() to authenticated;

create function adme_creator.proposal_choices(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare campaign public.campaigns;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into campaign from public.campaigns where id=p_campaign and moderation_status='allowed';
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.profile->>'name') order by c.id collate "C")
    from public.creators c where c.published and c.moderation_status='allowed' and c.owner_id is not null and
      ((campaign.owner_id=auth.uid() and public.my_role()='brand') or
        (campaign.status='published' and c.owner_id=auth.uid() and public.my_role()='creator'))),'[]'::jsonb);
end;
$$;
create function public.creator_proposal_choices(p_campaign uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.proposal_choices($1); $$;
revoke all on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) to authenticated;

create function adme_creator.proposal_allowed(p_campaign uuid,p_creator text,p_brand uuid,p_owner uuid,p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(exists(select 1 from public.campaigns ca join public.creators cr on cr.id=p_creator
    where ca.id=p_campaign and ca.owner_id=p_brand and cr.owner_id=p_owner
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((p_kind='proposal' and p_brand=auth.uid() and public.my_role()='brand')
        or (p_kind='application' and p_owner=auth.uid() and public.my_role()='creator' and ca.status='published'))),false);
$$;
revoke all on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) to authenticated;
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated with check(
  status='pending' and adme_creator.proposal_allowed(campaign_id,creator_id,brand_id,creator_user_id,kind)
);

create function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Fixed lock order; moderation/ownership changes cannot interleave after validation.
  select * into ca from public.campaigns where id=p_campaign for share;
  select * into cr from public.creators where id=p_creator for share;
  if ca.id is null or cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
create function public.create_creator_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language sql security invoker set search_path='' as $$ select adme_creator.create_proposal($1,$2,$3,$4); $$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) to authenticated;

create function adme_creator.hot_catalog() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select c.id,adme_creator.catalog_dto(c),max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and adme_creator.catalog_dto(c) is not null
    and e.sku='creator_hot' and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile,c.published,c.moderation_status,c.owner_id,c.created_at order by max(e.expires_at) desc,c.id collate "C" limit 6;
$$;
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog(); $$;
revoke all on function adme_creator.hot_catalog(),public.active_hot_creators() from public,anon,authenticated,service_role;
grant execute on function adme_creator.hot_catalog(),public.active_hot_creators() to anon,authenticated;

-- Apply only after compatibility RPCs exist. Own settings and approved classic
-- administration retain raw access; public views must use the allowlisted RPC.
drop policy creators_read on public.creators;
create policy creators_read on public.creators for select to authenticated using(owner_id=auth.uid() or public.is_admin());
revoke select on public.creators from anon;

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200014','creator_read_boundary',array[$boundary_source$-- D075/D018: preserve legacy IDs and private workflows while closing raw public reads.
begin;
create function adme_creator.public_https(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare authority text; port_value text;
begin
  if p_value is null or length(p_value)>2000 or
    p_value !~ '^https://([^@/:?#[:space:]\\]+|\[[A-Fa-f0-9:.]+\])(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$' then return null; end if;
  authority:=substring(p_value from '^https://([^/?#]+)');
  port_value:=substring(authority from ':([0-9]{1,5})$');
  if port_value is not null and port_value::int>65535 then return null; end if;
  return p_value;
end;
$$;
create function adme_creator.public_social(p_value text) returns text
language sql immutable set search_path='' as $$
  select case when adme_creator.public_https(p_value) is not null and (
    p_value ~ '^https://www\.youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}|channel/UC[A-Za-z0-9_-]{22}|@[A-Za-z0-9_.%~-]+)$'
    or p_value ~ '^https://www\.instagram\.com/([A-Za-z0-9_.]{1,30}|(p|reel)/[A-Za-z0-9_-]{1,32})/$'
    or p_value ~ '^https://www\.tiktok\.com/@[A-Za-z0-9_.]{1,24}(/video/[0-9]{1,25})?$'
  ) then p_value else null end;
$$;
create function adme_creator.catalog_dto(p_row public.creators) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb:=p_row.profile; social text; portfolio text; synthetic boolean; field_name text;
begin
  if not p_row.published or p_row.moderation_status<>'allowed' or not public.valid_creator_dto(p) then return null; end if;
  foreach field_name in array array['categories','vibes','formats','platforms'] loop
    if exists(select 1 from jsonb_array_elements_text(p->field_name) v where length(v)>50) then return null; end if;
  end loop;
  if (p->>'price_min_krw')::numeric<>trunc((p->>'price_min_krw')::numeric)
    or (p->>'price_max_krw')::numeric<>trunc((p->>'price_max_krw')::numeric) then return null; end if;
  synthetic:=p->'is_demo'='true'::jsonb and p->>'metrics_source'='synthetic_demo_not_verified';
  if synthetic and (p->>'followers')::numeric<>trunc((p->>'followers')::numeric) then return null; end if;
  if p->'owner_consent'='true'::jsonb then
    social:=adme_creator.public_social(p->>'social_url');
    portfolio:=adme_creator.public_https(p->>'portfolio_url');
  end if;
  return jsonb_build_object('seed_id',p_row.id,'name',p->'name','handle',p->'handle','bio',p->'bio',
    'categories',p->'categories','vibes',p->'vibes','formats',p->'formats','platforms',p->'platforms',
    'price_min_krw',p->'price_min_krw','price_max_krw',p->'price_max_krw',
    'followers',case when synthetic then p->'followers' else 'null'::jsonb end,
    'metrics_source',case when synthetic then 'synthetic_demo_not_verified' else 'unavailable' end,
    'is_available',p->'is_available','is_demo',p->'is_demo',
    'data_source',case when p->'is_demo'='true'::jsonb then 'generated fictional test fixture' else 'owner_registration' end,
    'source_url',social,'portrait_asset',null,'image_placeholder',case when p->'is_demo'='true'::jsonb then 'gradient_initials' else 'initials' end,
    'published',true) || case when social is null then '{}'::jsonb else jsonb_build_object('social_url',social) end
    || case when portfolio is null then '{}'::jsonb else jsonb_build_object('portfolio_url',portfolio) end;
end;
$$;
revoke all on function adme_creator.public_https(text),adme_creator.public_social(text),adme_creator.catalog_dto(public.creators) from public,anon,authenticated,service_role;

-- The present UI still filters a bounded snapshot. This cursor is compatibility
-- pagination, not D033's completed indexed server search/filter API.
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  with source as (
    select c.id,adme_creator.catalog_dto(c) dto from public.creators c
    where c.published and c.moderation_status='allowed' and c.id collate "C">p_after collate "C"
      and adme_creator.catalog_dto(c) is not null order by c.id collate "C" limit p_limit+1
  ), numbered as (select *,row_number() over(order by id collate "C") n from source)
  select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(dto order by id collate "C") filter(where n<=p_limit),'[]'::jsonb),
    'nextCursor',case when count(*)>p_limit then max(id collate "C") filter(where n<=p_limit) else null end) into result from numbered;
  return result;
end;
$$;
create function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
grant usage on schema adme_creator to anon;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;

create function adme_creator.saved_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('creator_id',s.creator_id,'creator',adme_creator.catalog_dto(c)) order by s.creator_id collate "C")
    from public.saved_creators s join public.creators c on c.id=s.creator_id where s.owner_id=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.my_saved_creator_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.saved_catalog(); $$;
revoke all on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() to authenticated;

create function adme_creator.proposal_choices(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare campaign public.campaigns;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into campaign from public.campaigns where id=p_campaign and moderation_status='allowed';
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.profile->>'name') order by c.id collate "C")
    from public.creators c where c.published and c.moderation_status='allowed' and c.owner_id is not null and
      ((campaign.owner_id=auth.uid() and public.my_role()='brand') or
        (campaign.status='published' and c.owner_id=auth.uid() and public.my_role()='creator'))),'[]'::jsonb);
end;
$$;
create function public.creator_proposal_choices(p_campaign uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.proposal_choices($1); $$;
revoke all on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) to authenticated;

create function adme_creator.proposal_allowed(p_campaign uuid,p_creator text,p_brand uuid,p_owner uuid,p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(exists(select 1 from public.campaigns ca join public.creators cr on cr.id=p_creator
    where ca.id=p_campaign and ca.owner_id=p_brand and cr.owner_id=p_owner
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((p_kind='proposal' and p_brand=auth.uid() and public.my_role()='brand')
        or (p_kind='application' and p_owner=auth.uid() and public.my_role()='creator' and ca.status='published'))),false);
$$;
revoke all on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) to authenticated;
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated with check(
  status='pending' and adme_creator.proposal_allowed(campaign_id,creator_id,brand_id,creator_user_id,kind)
);

create function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Fixed lock order; moderation/ownership changes cannot interleave after validation.
  select * into ca from public.campaigns where id=p_campaign for share;
  select * into cr from public.creators where id=p_creator for share;
  if ca.id is null or cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
create function public.create_creator_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language sql security invoker set search_path='' as $$ select adme_creator.create_proposal($1,$2,$3,$4); $$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) to authenticated;

create function adme_creator.hot_catalog() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select c.id,adme_creator.catalog_dto(c),max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and adme_creator.catalog_dto(c) is not null
    and e.sku='creator_hot' and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile,c.published,c.moderation_status,c.owner_id,c.created_at order by max(e.expires_at) desc,c.id collate "C" limit 6;
$$;
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog(); $$;
revoke all on function adme_creator.hot_catalog(),public.active_hot_creators() from public,anon,authenticated,service_role;
grant execute on function adme_creator.hot_catalog(),public.active_hot_creators() to anon,authenticated;

-- Apply only after compatibility RPCs exist. Own settings and approved classic
-- administration retain raw access; public views must use the allowlisted RPC.
drop policy creators_read on public.creators;
create policy creators_read on public.creators for select to authenticated using(owner_id=auth.uid() or public.is_admin());
revoke select on public.creators from anon;
commit;
$boundary_source$]);
-- D076: all public catalog pages pass the DB-owned atomic quota boundary.

alter function adme_creator.catalog_page(text,int) rename to catalog_page_rows;
revoke all on function adme_creator.catalog_page_rows(text,int) from public,anon,authenticated,service_role;
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),
    case when auth.uid() is null then 300 else 60 end,60);
  return adme_creator.catalog_page_rows(p_after,p_limit);
end;
$$;
create or replace function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql volatile security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200015','creator_catalog_quota',array[$boundary_source$-- D076: all public catalog pages pass the DB-owned atomic quota boundary.
begin;
alter function adme_creator.catalog_page(text,int) rename to catalog_page_rows;
revoke all on function adme_creator.catalog_page_rows(text,int) from public,anon,authenticated,service_role;
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),
    case when auth.uid() is null then 300 else 60 end,60);
  return adme_creator.catalog_page_rows(p_after,p_limit);
end;
$$;
create or replace function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql volatile security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;
notify pgrst,'reload schema';
commit;
$boundary_source$]);
-- Deployment compatibility: secure by default; only the reviewed atomic USER
-- packet for the old19 baseline requests staging before the read switch.

create table adme_creator.read_boundary (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true,
  activated_at timestamptz,
  release_ref text
);
alter table adme_creator.read_boundary enable row level security;
revoke all on adme_creator.read_boundary from public,anon,authenticated,service_role;
insert into adme_creator.read_boundary(singleton,enabled)
values(true,current_setting('adme.creator_boundary_staging',true) is distinct from 'on');
create function adme_creator.read_boundary_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from adme_creator.read_boundary where singleton),true);
$$;
revoke all on function adme_creator.read_boundary_enabled() from public,anon,authenticated,service_role;
grant execute on function adme_creator.read_boundary_enabled() to anon,authenticated;
create function adme_creator.guard_read_boundary() returns trigger
language plpgsql set search_path='' as $$
begin
  if TG_OP='DELETE' or (old.enabled and not new.enabled) then
    raise exception 'active read boundary cannot be reopened' using errcode='23514'; end if;
  if old.release_ref is not null and (new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at) then
    raise exception 'activation evidence is immutable' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function adme_creator.guard_read_boundary() from public,anon,authenticated,service_role;
create trigger creator_boundary_guard before update or delete on adme_creator.read_boundary
for each row execute function adme_creator.guard_read_boundary();
create function adme_creator.activate_read_boundary(p_release text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then
    raise exception 'reviewed release reference required' using errcode='22023'; end if;
  update adme_creator.read_boundary set enabled=true,
    release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;
  revoke select on public.creators from anon;
end;
$$;
revoke all on function adme_creator.activate_read_boundary(text) from public,anon,authenticated,service_role;
-- A fixed boolean check in the RLS rule retains old19 reads only in the reviewed
-- staging transaction. Own settings and approved admin reads remain independent.
drop policy creators_read on public.creators;
create policy creators_read on public.creators for select using(
  owner_id=auth.uid() or public.is_admin() or
  (not adme_creator.read_boundary_enabled() and published and moderation_status='allowed')
);
do $$ begin
  if not adme_creator.read_boundary_enabled() then grant select on public.creators to anon; end if;
end $$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200016','creator_boundary_activation',array[$boundary_source$-- Deployment compatibility: secure by default; only the reviewed atomic USER
-- packet for the old19 baseline requests staging before the read switch.
begin;
create table adme_creator.read_boundary (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true,
  activated_at timestamptz,
  release_ref text
);
alter table adme_creator.read_boundary enable row level security;
revoke all on adme_creator.read_boundary from public,anon,authenticated,service_role;
insert into adme_creator.read_boundary(singleton,enabled)
values(true,current_setting('adme.creator_boundary_staging',true) is distinct from 'on');
create function adme_creator.read_boundary_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from adme_creator.read_boundary where singleton),true);
$$;
revoke all on function adme_creator.read_boundary_enabled() from public,anon,authenticated,service_role;
grant execute on function adme_creator.read_boundary_enabled() to anon,authenticated;
create function adme_creator.guard_read_boundary() returns trigger
language plpgsql set search_path='' as $$
begin
  if TG_OP='DELETE' or (old.enabled and not new.enabled) then
    raise exception 'active read boundary cannot be reopened' using errcode='23514'; end if;
  if old.release_ref is not null and (new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at) then
    raise exception 'activation evidence is immutable' using errcode='23514'; end if;
  return new;
end;
$$;
revoke all on function adme_creator.guard_read_boundary() from public,anon,authenticated,service_role;
create trigger creator_boundary_guard before update or delete on adme_creator.read_boundary
for each row execute function adme_creator.guard_read_boundary();
create function adme_creator.activate_read_boundary(p_release text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then
    raise exception 'reviewed release reference required' using errcode='22023'; end if;
  update adme_creator.read_boundary set enabled=true,
    release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;
  revoke select on public.creators from anon;
end;
$$;
revoke all on function adme_creator.activate_read_boundary(text) from public,anon,authenticated,service_role;
-- A fixed boolean check in the RLS rule retains old19 reads only in the reviewed
-- staging transaction. Own settings and approved admin reads remain independent.
drop policy creators_read on public.creators;
create policy creators_read on public.creators for select using(
  owner_id=auth.uid() or public.is_admin() or
  (not adme_creator.read_boundary_enabled() and published and moderation_status='allowed')
);
do $$ begin
  if not adme_creator.read_boundary_enabled() then grant select on public.creators to anon; end if;
end $$;
notify pgrst,'reload schema';
commit;
$boundary_source$]);
-- Preserve the former RLS-hidden campaign behavior inside the compatibility RPC.

create or replace function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or p_kind is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Same visibility as the previous caller's SELECT under campaigns_read RLS.
  -- A foreign private campaign and a missing campaign return the same failure.
  select * into ca from public.campaigns where id=p_campaign
    and (owner_id=auth.uid() or status='published') for share;
  if ca.id is null then raise exception 'collaboration unavailable' using errcode='23514'; end if;
  select * into cr from public.creators where id=p_creator for share;
  if cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200017','proposal_visibility',array[$boundary_source$-- Preserve the former RLS-hidden campaign behavior inside the compatibility RPC.
begin;
create or replace function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or p_kind is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Same visibility as the previous caller's SELECT under campaigns_read RLS.
  -- A foreign private campaign and a missing campaign return the same failure.
  select * into ca from public.campaigns where id=p_campaign
    and (owner_id=auth.uid() or status='published') for share;
  if ca.id is null then raise exception 'collaboration unavailable' using errcode='23514'; end if;
  select * into cr from public.creators where id=p_creator for share;
  if cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
$boundary_source$]);
commit;
