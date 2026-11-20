-- USER console only. Never force past an unexpected/partial baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or to_regprocedure('public.ops_draft_get(uuid)') is null
     or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null then
    raise exception 'STOP: supported main schema missing; agent must inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012'))<>18
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005','202611190004','202611190005','202611190006','202611190007','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012'))
     or to_regnamespace('adme_creator') is not null then
    raise exception 'STOP: wrong, partial, unknown or already updated baseline; do not force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected public-invoker/private-implementation boundary missing';
  end if;
end $preflight$;

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
