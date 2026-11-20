-- USER console only. Never force past an unexpected/partial baseline.
do $preflight$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null
     or to_regprocedure('public.ops_draft_get(uuid)') is null
     or to_regprocedure('adme_ops.ops_draft_get(uuid)') is null then
    raise exception 'STOP: supported main schema missing; agent must inspect';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations where version in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005'))<>8
     or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611200001','202611200002','202611200003','202611200004','202611200005'))
     or to_regnamespace('adme_creator') is not null then
    raise exception 'STOP: wrong, partial, unknown or already updated baseline; do not force SQL';
  end if;
  if (select prosecdef from pg_proc where oid='public.ops_draft_get(uuid)'::regprocedure) then
    raise exception 'STOP: expected public-invoker/private-implementation boundary missing';
  end if;
end $preflight$;

-- Source SHA-256 (UTF-8, LF): 09373c91a5fe7b415aa23d56a96dc9c23b5d9fe4e8fca3ac25c946563168919c
-- D016: reserved by DEV-A. Additive, no implicit grandfathering of role-only admins.
begin;
create table public.administrator_grants (
  user_id uuid primary key references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  approval_reference text not null check (length(approval_reference) between 5 and 300),
  granted_by text not null,
  check (expires_at > granted_at)
);
alter table public.administrator_grants enable row level security;
revoke all on public.administrator_grants from public, anon, authenticated, service_role;

create function public.is_admin_provisioned() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.administrator_grants g on g.user_id = p.id
    where p.id = auth.uid() and p.role = 'admin' and g.revoked_at is null and g.expires_at > now()
  );
$$;
revoke all on function public.is_admin_provisioned() from public, anon;
grant execute on function public.is_admin_provisioned() to authenticated;

create function public.admin_mfa_recent() returns boolean
language plpgsql stable set search_path = '' as $$
declare claims jsonb := auth.jwt(); entry jsonb; verified_at bigint;
begin
  if (claims->>'aal') is distinct from 'aal2' or jsonb_typeof(claims->'amr') is distinct from 'array' then return false; end if;
  for entry in select value from jsonb_array_elements(claims->'amr') loop
    if entry->>'method' in ('totp', 'mfa/totp') and jsonb_typeof(entry->'timestamp') = 'number'
       and (entry->>'timestamp') ~ '^[0-9]{1,12}$' then
      verified_at := (entry->>'timestamp')::bigint;
      if verified_at between extract(epoch from now()) - 900 and extract(epoch from now()) then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.admin_mfa_recent() from public, anon;
grant execute on function public.admin_mfa_recent() to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin_provisioned() and public.admin_mfa_recent();
$$;
-- Anonymous policies also call is_admin(); it only returns false for anonymous JWTs.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- SQL Editor/database-owner only. Never callable through browser or a service-role API.
create function public.provision_administrator(p_user uuid, p_approval_reference text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '90 days'
     or p_approval_reference is null or length(btrim(p_approval_reference)) not between 5 and 300 then
    raise exception 'invalid administrator approval' using errcode = '22023';
  end if;
  if not exists(select 1 from public.profiles where id = p_user) then
    raise exception 'account not found' using errcode = '22023';
  end if;
  insert into public.administrator_grants(user_id, granted_at, expires_at, revoked_at, approval_reference, granted_by)
  values(p_user, now(), p_expires_at, null, btrim(p_approval_reference), session_user)
  on conflict(user_id) do update set granted_at=excluded.granted_at, expires_at=excluded.expires_at,
    revoked_at=null, approval_reference=excluded.approval_reference, granted_by=excluded.granted_by;
  update public.profiles set role='admin' where id=p_user;
  insert into public.audit_log(actor_id, entity_id, action) values(null, p_user::text, 'admin:provision');
end;
$$;
create function public.revoke_administrator(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.administrator_grants set revoked_at=now() where user_id=p_user and revoked_at is null;
  if found then
    insert into public.audit_log(actor_id, entity_id, action) values(null, p_user::text, 'admin:revoke');
  end if;
end;
$$;
revoke all on function public.provision_administrator(uuid,text,timestamptz), public.revoke_administrator(uuid)
  from public, anon, authenticated, service_role;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190004','admin_security',array[$adme_schema_packet$-- D016: reserved by DEV-A. Additive, no implicit grandfathering of role-only admins.
begin;
create table public.administrator_grants (
  user_id uuid primary key references public.profiles(id),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  approval_reference text not null check (length(approval_reference) between 5 and 300),
  granted_by text not null,
  check (expires_at > granted_at)
);
alter table public.administrator_grants enable row level security;
revoke all on public.administrator_grants from public, anon, authenticated, service_role;

create function public.is_admin_provisioned() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p join public.administrator_grants g on g.user_id = p.id
    where p.id = auth.uid() and p.role = 'admin' and g.revoked_at is null and g.expires_at > now()
  );
$$;
revoke all on function public.is_admin_provisioned() from public, anon;
grant execute on function public.is_admin_provisioned() to authenticated;

create function public.admin_mfa_recent() returns boolean
language plpgsql stable set search_path = '' as $$
declare claims jsonb := auth.jwt(); entry jsonb; verified_at bigint;
begin
  if (claims->>'aal') is distinct from 'aal2' or jsonb_typeof(claims->'amr') is distinct from 'array' then return false; end if;
  for entry in select value from jsonb_array_elements(claims->'amr') loop
    if entry->>'method' in ('totp', 'mfa/totp') and jsonb_typeof(entry->'timestamp') = 'number'
       and (entry->>'timestamp') ~ '^[0-9]{1,12}$' then
      verified_at := (entry->>'timestamp')::bigint;
      if verified_at between extract(epoch from now()) - 900 and extract(epoch from now()) then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;
revoke all on function public.admin_mfa_recent() from public, anon;
grant execute on function public.admin_mfa_recent() to authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin_provisioned() and public.admin_mfa_recent();
$$;
-- Anonymous policies also call is_admin(); it only returns false for anonymous JWTs.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- SQL Editor/database-owner only. Never callable through browser or a service-role API.
create function public.provision_administrator(p_user uuid, p_approval_reference text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '90 days'
     or p_approval_reference is null or length(btrim(p_approval_reference)) not between 5 and 300 then
    raise exception 'invalid administrator approval' using errcode = '22023';
  end if;
  if not exists(select 1 from public.profiles where id = p_user) then
    raise exception 'account not found' using errcode = '22023';
  end if;
  insert into public.administrator_grants(user_id, granted_at, expires_at, revoked_at, approval_reference, granted_by)
  values(p_user, now(), p_expires_at, null, btrim(p_approval_reference), session_user)
  on conflict(user_id) do update set granted_at=excluded.granted_at, expires_at=excluded.expires_at,
    revoked_at=null, approval_reference=excluded.approval_reference, granted_by=excluded.granted_by;
  update public.profiles set role='admin' where id=p_user;
  insert into public.audit_log(actor_id, entity_id, action) values(null, p_user::text, 'admin:provision');
end;
$$;
create function public.revoke_administrator(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.administrator_grants set revoked_at=now() where user_id=p_user and revoked_at is null;
  if found then
    insert into public.audit_log(actor_id, entity_id, action) values(null, p_user::text, 'admin:revoke');
  end if;
end;
$$;
revoke all on function public.provision_administrator(uuid,text,timestamptz), public.revoke_administrator(uuid)
  from public, anon, authenticated, service_role;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 2d94f26f37e1804301b18c1143f24bc4cb151a711ddc8b3372d4232f95a62e2d
-- D059: owner publication preference and operator lock are independent.
begin;
alter table public.creators add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
alter table public.campaigns add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
create table public.moderation_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  entity_kind text not null check (entity_kind in ('creator','campaign')),
  entity_id text not null,
  previous_status text not null,
  next_status text not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from public, anon, authenticated;
grant select on public.moderation_events to authenticated;
create policy moderation_events_admin on public.moderation_events for select to authenticated using(public.is_admin());

create function public.guard_moderation_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if old.moderation_status = 'restricted' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock prevents delete and recreate' using errcode = '42501';
    end if;
    return old;
  end if;
  if (TG_OP = 'INSERT' and new.moderation_status <> 'allowed')
     or (TG_OP = 'UPDATE' and (new.moderation_status is distinct from old.moderation_status)) then
    -- Only the guarded SECURITY DEFINER RPC (postgres) can change a lock.
    -- Even an administrator's direct REST UPDATE must go through the audited RPC.
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock is managed by operators' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_moderation_lock() from public, anon, authenticated;
create trigger creators_moderation_lock before insert or update or delete on public.creators for each row execute function public.guard_moderation_lock();
create trigger campaigns_moderation_lock before insert or update or delete on public.campaigns for each row execute function public.guard_moderation_lock();

drop policy creators_read on public.creators;
create policy creators_read on public.creators for select using(
  (published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
drop policy campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using(
  (status='published' and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
-- Prevent direct proposals using a locked creator/campaign even when caller owns that row.
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert with check (
  status='pending' and exists (
    select 1 from public.campaigns ca join public.creators cr on cr.id=creator_id
    where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((kind='proposal' and brand_id=auth.uid() and public.my_role()='brand')
        or (kind='application' and creator_user_id=auth.uid() and public.my_role()='creator' and ca.status='published'))
  )
);

create function public.moderate_entity(p_kind text,p_id text,p_published boolean,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous text; desired text := case when p_published then 'allowed' else 'restricted' end;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'moderation reason required' using errcode='22023';
  end if;
  if p_kind='creator' then
    select moderation_status into previous from public.creators where id=p_id for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.creators set moderation_status=desired where id=p_id;
  elsif p_kind='campaign' then
    select moderation_status into previous from public.campaigns where id=p_id::uuid for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.campaigns set moderation_status=desired where id=p_id::uuid;
  else raise exception 'invalid entity' using errcode='22023'; end if;
  if previous=desired then return; end if;
  insert into public.moderation_events(actor_id,entity_kind,entity_id,previous_status,next_status,reason)
    values(auth.uid(),p_kind,p_id,previous,desired,btrim(p_reason));
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p_id,'moderate:'||p_kind||':'||desired);
end;
$$;
-- Preserve the old signature; deny unaudited old-client changes until upgraded.
create or replace function public.moderate_entity(p_kind text,p_id text,p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  raise exception 'moderation reason required; upgrade client' using errcode='22023';
end;
$$;
revoke all on function public.moderate_entity(text,text,boolean,text) from public, anon;
grant execute on function public.moderate_entity(text,text,boolean,text) to authenticated;

create or replace function public.active_hot_creators()
returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,c.profile,max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and e.sku='creator_hot'
    and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile order by max(e.expires_at) desc limit 6;
$$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190005','moderation_locks',array[$adme_schema_packet$-- D059: owner publication preference and operator lock are independent.
begin;
alter table public.creators add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
alter table public.campaigns add column moderation_status text not null default 'allowed'
  check (moderation_status in ('allowed','restricted'));
create table public.moderation_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.profiles(id),
  entity_kind text not null check (entity_kind in ('creator','campaign')),
  entity_id text not null,
  previous_status text not null,
  next_status text not null,
  reason text not null check (length(btrim(reason)) between 5 and 500),
  created_at timestamptz not null default now()
);
alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from public, anon, authenticated;
grant select on public.moderation_events to authenticated;
create policy moderation_events_admin on public.moderation_events for select to authenticated using(public.is_admin());

create function public.guard_moderation_lock() returns trigger
language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'DELETE' then
    if old.moderation_status = 'restricted' and current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock prevents delete and recreate' using errcode = '42501';
    end if;
    return old;
  end if;
  if (TG_OP = 'INSERT' and new.moderation_status <> 'allowed')
     or (TG_OP = 'UPDATE' and (new.moderation_status is distinct from old.moderation_status)) then
    -- Only the guarded SECURITY DEFINER RPC (postgres) can change a lock.
    -- Even an administrator's direct REST UPDATE must go through the audited RPC.
    if current_user not in ('postgres', 'supabase_admin') then
      raise exception 'moderation lock is managed by operators' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_moderation_lock() from public, anon, authenticated;
create trigger creators_moderation_lock before insert or update or delete on public.creators for each row execute function public.guard_moderation_lock();
create trigger campaigns_moderation_lock before insert or update or delete on public.campaigns for each row execute function public.guard_moderation_lock();

drop policy creators_read on public.creators;
create policy creators_read on public.creators for select using(
  (published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
drop policy campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns for select using(
  (status='published' and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin()
);
-- Prevent direct proposals using a locked creator/campaign even when caller owns that row.
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert with check (
  status='pending' and exists (
    select 1 from public.campaigns ca join public.creators cr on cr.id=creator_id
    where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((kind='proposal' and brand_id=auth.uid() and public.my_role()='brand')
        or (kind='application' and creator_user_id=auth.uid() and public.my_role()='creator' and ca.status='published'))
  )
);

create function public.moderate_entity(p_kind text,p_id text,p_published boolean,p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare previous text; desired text := case when p_published then 'allowed' else 'restricted' end;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then
    raise exception 'moderation reason required' using errcode='22023';
  end if;
  if p_kind='creator' then
    select moderation_status into previous from public.creators where id=p_id for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.creators set moderation_status=desired where id=p_id;
  elsif p_kind='campaign' then
    select moderation_status into previous from public.campaigns where id=p_id::uuid for update;
    if not found then raise exception 'entity not found' using errcode='P0002'; end if;
    update public.campaigns set moderation_status=desired where id=p_id::uuid;
  else raise exception 'invalid entity' using errcode='22023'; end if;
  if previous=desired then return; end if;
  insert into public.moderation_events(actor_id,entity_kind,entity_id,previous_status,next_status,reason)
    values(auth.uid(),p_kind,p_id,previous,desired,btrim(p_reason));
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p_id,'moderate:'||p_kind||':'||desired);
end;
$$;
-- Preserve the old signature; deny unaudited old-client changes until upgraded.
create or replace function public.moderate_entity(p_kind text,p_id text,p_published boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
  raise exception 'moderation reason required; upgrade client' using errcode='22023';
end;
$$;
revoke all on function public.moderate_entity(text,text,boolean,text) from public, anon;
grant execute on function public.moderate_entity(text,text,boolean,text) to authenticated;

create or replace function public.active_hot_creators()
returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select c.id,c.profile,max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and e.sku='creator_hot'
    and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile order by max(e.expires_at) desc limit 6;
$$;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 315f1ba58ebc1eefb8907be44498a604626cf35f75cba3e8b7a4755260a85233
-- D012 additive public brand / private contact split; logo attachment awaits D027.
begin;
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id),
  brand_name text not null check(length(btrim(brand_name)) between 2 and 120),
  industry text not null check(length(btrim(industry)) between 1 and 80),
  introduction text not null default '' check(length(introduction)<=2000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.brand_contacts (
  owner_id uuid primary key references public.profiles(id),
  contact_name text not null default '' check(length(contact_name)<=80),
  contact_email text not null default '' check(contact_email='' or (length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  visibility text not null default 'private' check(visibility in ('private','collaborators')),
  check(visibility='private' or (length(btrim(contact_name))>0 and length(contact_email)>0))
);
alter table public.brand_profiles enable row level security;
alter table public.brand_contacts enable row level security;
revoke all on public.brand_profiles, public.brand_contacts from public, anon, authenticated;
-- Public projection intentionally excludes the private owner identifier.
grant select(id,brand_name,industry,introduction,published,updated_at) on public.brand_profiles to anon;
grant select,insert,update,delete on public.brand_profiles, public.brand_contacts to authenticated;
create policy brand_profiles_read on public.brand_profiles for select using(published or owner_id=auth.uid());
create policy brand_profiles_write on public.brand_profiles for insert to authenticated
  with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_profiles_edit on public.brand_profiles for update to authenticated
  using(owner_id=auth.uid() and public.my_role()='brand') with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_profiles_delete on public.brand_profiles for delete to authenticated using(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_read on public.brand_contacts for select to authenticated using(
  owner_id=auth.uid() or (visibility='collaborators' and exists (
    select 1 from public.proposals p where p.brand_id=owner_id and p.creator_user_id=auth.uid()
      and p.status in ('accepted','submitted','revision_requested','completed')
  ))
);
create policy brand_contacts_insert on public.brand_contacts for insert to authenticated
  with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_update on public.brand_contacts for update to authenticated
  using(owner_id=auth.uid() and public.my_role()='brand') with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_delete on public.brand_contacts for delete to authenticated using(owner_id=auth.uid() and public.my_role()='brand');

create function public.save_brand_account(p_name text,p_brand_name text,p_industry text,p_introduction text,
  p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null or public.my_role() is distinct from 'brand' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 80 then raise exception 'invalid name' using errcode='22023'; end if;
  update public.profiles set name=btrim(p_name) where id=auth.uid();
  insert into public.brand_profiles(owner_id,brand_name,industry,introduction,published)
  values(auth.uid(),btrim(p_brand_name),btrim(p_industry),btrim(p_introduction),p_published)
  on conflict(owner_id) do update set brand_name=excluded.brand_name,industry=excluded.industry,
    introduction=excluded.introduction,published=excluded.published,updated_at=now() returning id into result;
  insert into public.brand_contacts(owner_id,contact_name,contact_email,visibility)
  values(auth.uid(),btrim(p_contact_name),btrim(p_contact_email),p_contact_visibility)
  on conflict(owner_id) do update set contact_name=excluded.contact_name,contact_email=excluded.contact_email,visibility=excluded.visibility;
  return result;
end;
$$;
revoke all on function public.save_brand_account(text,text,text,text,boolean,text,text,text) from public,anon;
grant execute on function public.save_brand_account(text,text,text,text,boolean,text,text,text) to authenticated;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190006','brand_profiles',array[$adme_schema_packet$-- D012 additive public brand / private contact split; logo attachment awaits D027.
begin;
create table public.brand_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id),
  brand_name text not null check(length(btrim(brand_name)) between 2 and 120),
  industry text not null check(length(btrim(industry)) between 1 and 80),
  introduction text not null default '' check(length(introduction)<=2000),
  published boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.brand_contacts (
  owner_id uuid primary key references public.profiles(id),
  contact_name text not null default '' check(length(contact_name)<=80),
  contact_email text not null default '' check(contact_email='' or (length(contact_email)<=254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  visibility text not null default 'private' check(visibility in ('private','collaborators')),
  check(visibility='private' or (length(btrim(contact_name))>0 and length(contact_email)>0))
);
alter table public.brand_profiles enable row level security;
alter table public.brand_contacts enable row level security;
revoke all on public.brand_profiles, public.brand_contacts from public, anon, authenticated;
-- Public projection intentionally excludes the private owner identifier.
grant select(id,brand_name,industry,introduction,published,updated_at) on public.brand_profiles to anon;
grant select,insert,update,delete on public.brand_profiles, public.brand_contacts to authenticated;
create policy brand_profiles_read on public.brand_profiles for select using(published or owner_id=auth.uid());
create policy brand_profiles_write on public.brand_profiles for insert to authenticated
  with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_profiles_edit on public.brand_profiles for update to authenticated
  using(owner_id=auth.uid() and public.my_role()='brand') with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_profiles_delete on public.brand_profiles for delete to authenticated using(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_read on public.brand_contacts for select to authenticated using(
  owner_id=auth.uid() or (visibility='collaborators' and exists (
    select 1 from public.proposals p where p.brand_id=owner_id and p.creator_user_id=auth.uid()
      and p.status in ('accepted','submitted','revision_requested','completed')
  ))
);
create policy brand_contacts_insert on public.brand_contacts for insert to authenticated
  with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_update on public.brand_contacts for update to authenticated
  using(owner_id=auth.uid() and public.my_role()='brand') with check(owner_id=auth.uid() and public.my_role()='brand');
create policy brand_contacts_delete on public.brand_contacts for delete to authenticated using(owner_id=auth.uid() and public.my_role()='brand');

create function public.save_brand_account(p_name text,p_brand_name text,p_industry text,p_introduction text,
  p_published boolean,p_contact_name text,p_contact_email text,p_contact_visibility text)
returns uuid language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
  if auth.uid() is null or public.my_role() is distinct from 'brand' then raise exception 'forbidden' using errcode='42501'; end if;
  if p_name is null or length(btrim(p_name)) not between 2 and 80 then raise exception 'invalid name' using errcode='22023'; end if;
  update public.profiles set name=btrim(p_name) where id=auth.uid();
  insert into public.brand_profiles(owner_id,brand_name,industry,introduction,published)
  values(auth.uid(),btrim(p_brand_name),btrim(p_industry),btrim(p_introduction),p_published)
  on conflict(owner_id) do update set brand_name=excluded.brand_name,industry=excluded.industry,
    introduction=excluded.introduction,published=excluded.published,updated_at=now() returning id into result;
  insert into public.brand_contacts(owner_id,contact_name,contact_email,visibility)
  values(auth.uid(),btrim(p_contact_name),btrim(p_contact_email),p_contact_visibility)
  on conflict(owner_id) do update set contact_name=excluded.contact_name,contact_email=excluded.contact_email,visibility=excluded.visibility;
  return result;
end;
$$;
revoke all on function public.save_brand_account(text,text,text,text,boolean,text,text,text) from public,anon;
grant execute on function public.save_brand_account(text,text,text,text,boolean,text,text,text) to authenticated;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 6a97a7a086bfc5407b94108336e31b03472f0014a37a618ab15ef5f32ab92cad
-- D012 forward hardening: owner UUID is private even through direct authenticated REST.
begin;
revoke select on public.brand_profiles from authenticated;
grant select(id,brand_name,industry,introduction,published,updated_at) on public.brand_profiles to authenticated;
-- save_brand_account already derives owner from auth.uid() and checks current DB role.
alter function public.save_brand_account(text,text,text,text,boolean,text,text,text) security definer;
create function public.my_brand_account() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id', b.id, 'brand_name', b.brand_name, 'industry', b.industry,
    'introduction', b.introduction, 'published', b.published, 'contact_name', coalesce(c.contact_name,''),
    'contact_email', coalesce(c.contact_email,''), 'visibility', coalesce(c.visibility,'private'))
  from public.brand_profiles b left join public.brand_contacts c on c.owner_id=b.owner_id
  where b.owner_id=auth.uid();
$$;
create function public.brand_contact_for(p_brand_id uuid)
returns table(contact_name text, contact_email text)
language sql stable security definer set search_path='' as $$
  select c.contact_name,c.contact_email from public.brand_contacts c
  join public.brand_profiles b on b.owner_id=c.owner_id
  where b.id=p_brand_id and (c.owner_id=auth.uid() or (
    c.visibility='collaborators' and exists(select 1 from public.proposals p
      where p.brand_id=c.owner_id and p.creator_user_id=auth.uid()
        and p.status in ('accepted','submitted','revision_requested','completed'))
  ));
$$;
revoke all on function public.my_brand_account(), public.brand_contact_for(uuid) from public,anon;
grant execute on function public.my_brand_account(), public.brand_contact_for(uuid) to authenticated;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190007','brand_projection',array[$adme_schema_packet$-- D012 forward hardening: owner UUID is private even through direct authenticated REST.
begin;
revoke select on public.brand_profiles from authenticated;
grant select(id,brand_name,industry,introduction,published,updated_at) on public.brand_profiles to authenticated;
-- save_brand_account already derives owner from auth.uid() and checks current DB role.
alter function public.save_brand_account(text,text,text,text,boolean,text,text,text) security definer;
create function public.my_brand_account() returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id', b.id, 'brand_name', b.brand_name, 'industry', b.industry,
    'introduction', b.introduction, 'published', b.published, 'contact_name', coalesce(c.contact_name,''),
    'contact_email', coalesce(c.contact_email,''), 'visibility', coalesce(c.visibility,'private'))
  from public.brand_profiles b left join public.brand_contacts c on c.owner_id=b.owner_id
  where b.owner_id=auth.uid();
$$;
create function public.brand_contact_for(p_brand_id uuid)
returns table(contact_name text, contact_email text)
language sql stable security definer set search_path='' as $$
  select c.contact_name,c.contact_email from public.brand_contacts c
  join public.brand_profiles b on b.owner_id=c.owner_id
  where b.id=p_brand_id and (c.owner_id=auth.uid() or (
    c.visibility='collaborators' and exists(select 1 from public.proposals p
      where p.brand_id=c.owner_id and p.creator_user_id=auth.uid()
        and p.status in ('accepted','submitted','revision_requested','completed'))
  ));
$$;
revoke all on function public.my_brand_account(), public.brand_contact_for(uuid) from public,anon;
grant execute on function public.my_brand_account(), public.brand_contact_for(uuid) to authenticated;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 91363ca7a0fb5b7a4229b2bca407f07685f728ea3c3fa90aaca3c38e435cf39a
-- D016 DEV-A reserved 2026-11-20. Existing main migrations remain unchanged.
begin;
alter table adme_ops.staff
  add column approved_at timestamptz,
  add column expires_at timestamptz,
  add column approval_reference text,
  add column granted_by uuid references public.profiles(id),
  add constraint ops_staff_approval check (
    (approved_at is null and expires_at is null and approval_reference is null) or
    (approved_at is not null and expires_at is not null and approval_reference is not null and expires_at > approved_at
     and length(btrim(approval_reference)) between 5 and 300)
  );
-- Historical role-only rows deliberately remain unapproved until renewed.
create function adme_ops.enrollment_role() returns text
language sql stable security definer set search_path='' as $$
  select coalesce(
    case when public.is_admin_provisioned() then 'super' end,
    (select role from adme_ops.staff where user_id=auth.uid()
      and approved_at is not null and expires_at > now())
  );
$$;
revoke all on function adme_ops.enrollment_role() from public,anon,authenticated;

create or replace function adme_ops.staff_role() returns text
language sql stable set search_path='' as $$
  select case when public.admin_mfa_recent() then adme_ops.enrollment_role() end;
$$;
-- Only an account's own eligibility is exposed before OTP; no operational data.
create function adme_ops.ops_enrollment_role() returns text
language sql stable security definer set search_path='' as $$
  select adme_ops.enrollment_role();
$$;
create function public.ops_enrollment_role() returns text
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_enrollment_role();
$$;
revoke all on function adme_ops.ops_enrollment_role(), public.ops_enrollment_role()
  from public,anon,authenticated;
grant execute on function adme_ops.ops_enrollment_role(), public.ops_enrollment_role() to authenticated;

create function adme_ops.guard_staff_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if session_user in ('postgres','supabase_admin') then return coalesce(new,old); end if;
  if adme_ops.staff_role() is distinct from 'super' or coalesce(new.user_id,old.user_id)=auth.uid()
     or coalesce(new.role,old.role)='super' or (tg_op='UPDATE' and old.role='super') then
    raise insufficient_privilege;
  end if;
  if tg_op <> 'DELETE' then
    new.approved_at := now();
    new.expires_at := now()+interval '7 days';
    new.approval_reference := 'OTP-approved staff invitation by '||auth.uid()::text;
    new.granted_by := auth.uid();
    return new;
  end if;
  return old;
end;
$$;
revoke all on function adme_ops.guard_staff_approval() from public,anon,authenticated;
create trigger ops_staff_approval before insert or update or delete on adme_ops.staff
for each row execute function adme_ops.guard_staff_approval();

-- Database-owner console only. Does not promote the normal account's profile role.
create function adme_ops.provision_staff(p_user uuid,p_role text,p_approval text,p_expires timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_role is null or p_role not in ('super','content','campaign','finance','support')
    or p_approval is null or length(btrim(p_approval)) not between 5 and 300
    or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days' then
    raise invalid_parameter_value;
  end if;
  insert into adme_ops.staff(user_id,role,approved_at,expires_at,approval_reference)
    values(p_user,p_role,now(),p_expires,btrim(p_approval))
    on conflict(user_id) do update set role=excluded.role,approved_at=excluded.approved_at,
      expires_at=excluded.expires_at,approval_reference=excluded.approval_reference,granted_by=null;
  insert into public.audit_log(actor_id,entity_id,action) values(null,p_user::text,'ops:provision:'||p_role);
end;
$$;
revoke all on function adme_ops.provision_staff(uuid,text,text,timestamptz)
  from public,anon,authenticated,service_role;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200006','ops_mfa',array[$adme_schema_packet$-- D016 DEV-A reserved 2026-11-20. Existing main migrations remain unchanged.
begin;
alter table adme_ops.staff
  add column approved_at timestamptz,
  add column expires_at timestamptz,
  add column approval_reference text,
  add column granted_by uuid references public.profiles(id),
  add constraint ops_staff_approval check (
    (approved_at is null and expires_at is null and approval_reference is null) or
    (approved_at is not null and expires_at is not null and approval_reference is not null and expires_at > approved_at
     and length(btrim(approval_reference)) between 5 and 300)
  );
-- Historical role-only rows deliberately remain unapproved until renewed.
create function adme_ops.enrollment_role() returns text
language sql stable security definer set search_path='' as $$
  select coalesce(
    case when public.is_admin_provisioned() then 'super' end,
    (select role from adme_ops.staff where user_id=auth.uid()
      and approved_at is not null and expires_at > now())
  );
$$;
revoke all on function adme_ops.enrollment_role() from public,anon,authenticated;

create or replace function adme_ops.staff_role() returns text
language sql stable set search_path='' as $$
  select case when public.admin_mfa_recent() then adme_ops.enrollment_role() end;
$$;
-- Only an account's own eligibility is exposed before OTP; no operational data.
create function adme_ops.ops_enrollment_role() returns text
language sql stable security definer set search_path='' as $$
  select adme_ops.enrollment_role();
$$;
create function public.ops_enrollment_role() returns text
language sql stable security invoker set search_path='' as $$
  select adme_ops.ops_enrollment_role();
$$;
revoke all on function adme_ops.ops_enrollment_role(), public.ops_enrollment_role()
  from public,anon,authenticated;
grant execute on function adme_ops.ops_enrollment_role(), public.ops_enrollment_role() to authenticated;

create function adme_ops.guard_staff_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if session_user in ('postgres','supabase_admin') then return coalesce(new,old); end if;
  if adme_ops.staff_role() is distinct from 'super' or coalesce(new.user_id,old.user_id)=auth.uid()
     or coalesce(new.role,old.role)='super' or (tg_op='UPDATE' and old.role='super') then
    raise insufficient_privilege;
  end if;
  if tg_op <> 'DELETE' then
    new.approved_at := now();
    new.expires_at := now()+interval '7 days';
    new.approval_reference := 'OTP-approved staff invitation by '||auth.uid()::text;
    new.granted_by := auth.uid();
    return new;
  end if;
  return old;
end;
$$;
revoke all on function adme_ops.guard_staff_approval() from public,anon,authenticated;
create trigger ops_staff_approval before insert or update or delete on adme_ops.staff
for each row execute function adme_ops.guard_staff_approval();

-- Database-owner console only. Does not promote the normal account's profile role.
create function adme_ops.provision_staff(p_user uuid,p_role text,p_approval text,p_expires timestamptz)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_role is null or p_role not in ('super','content','campaign','finance','support')
    or p_approval is null or length(btrim(p_approval)) not between 5 and 300
    or p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days' then
    raise invalid_parameter_value;
  end if;
  insert into adme_ops.staff(user_id,role,approved_at,expires_at,approval_reference)
    values(p_user,p_role,now(),p_expires,btrim(p_approval))
    on conflict(user_id) do update set role=excluded.role,approved_at=excluded.approved_at,
      expires_at=excluded.expires_at,approval_reference=excluded.approval_reference,granted_by=null;
  insert into public.audit_log(actor_id,entity_id,action) values(null,p_user::text,'ops:provision:'||p_role);
end;
$$;
revoke all on function adme_ops.provision_staff(uuid,text,text,timestamptz)
  from public,anon,authenticated,service_role;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): a12d3f449afe6d38077ef45cd3aa5d42dc75e5982edc43b06a418c776e4ba90f
-- D076: atomic shared quotas. All subjects/limits are chosen on the server/DB.
begin;
-- New provider/model work is opt-in at the DB boundary as well as the app.
create table adme_ops.resource_controls (
  singleton boolean primary key default true check(singleton),
  ingestion_enabled boolean not null default false,
  llm_enabled boolean not null default false
);
insert into adme_ops.resource_controls default values;
alter table adme_ops.resource_controls enable row level security;
revoke all on adme_ops.resource_controls from public,anon,authenticated,service_role;
create function adme_ops.job_enabled(p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select case when p_kind='marketing_draft' then llm_enabled
    when p_kind in ('youtube_channel','youtube_daily','youtube_claim') then ingestion_enabled else false end
    from adme_ops.resource_controls where singleton),false);
$$;
revoke all on function adme_ops.job_enabled(text) from public,anon,authenticated,service_role;
update adme_ops.settings set discovery_enabled=false where singleton=true;
create function adme_ops.guard_discovery_enable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.discovery_enabled and not adme_ops.job_enabled('youtube_daily') then
    raise sqlstate 'PT404' using message='feature disabled';
  end if;
  return new;
end;
$$;
create function adme_ops.pause_discovery() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.ingestion_enabled then update adme_ops.settings set discovery_enabled=false where singleton=true; end if;
  return new;
end;
$$;
revoke all on function adme_ops.guard_discovery_enable(),adme_ops.pause_discovery() from public,anon,authenticated;
create trigger ops_discovery_gate before update on adme_ops.settings for each row execute function adme_ops.guard_discovery_enable();
create trigger ops_resource_pause after update on adme_ops.resource_controls for each row execute function adme_ops.pause_discovery();
create table adme_ops.rate_windows (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  used integer not null check(used>0),
  primary key(scope,subject,window_start)
);
alter table adme_ops.rate_windows enable row level security;
revoke all on adme_ops.rate_windows from public,anon,authenticated,service_role;
create index ops_rate_expiry on adme_ops.rate_windows(window_start);

create function adme_ops.take_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns int language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; accepted int;
begin
  if p_scope is null or length(p_scope) not between 1 and 80
     or p_subject is null or length(p_subject) not between 1 and 100
     or p_limit is null or p_limit not between 1 and 100000
     or p_window is null or p_window not between 1 and 86400
     or p_cost is null or p_cost not between 1 and p_limit then raise invalid_parameter_value; end if;
  start_at := to_timestamp(floor(extract(epoch from statement_timestamp())/p_window)*p_window);
  insert into adme_ops.rate_windows(scope,subject,window_start,used)
    values(p_scope,p_subject,start_at,p_cost)
    on conflict(scope,subject,window_start) do update set used=adme_ops.rate_windows.used+excluded.used
      where adme_ops.rate_windows.used+excluded.used<=p_limit
    returning used into accepted;
  if accepted is not null then return 0; end if;
  return greatest(1,ceil(extract(epoch from start_at+make_interval(secs=>p_window)-statement_timestamp()))::int);
end;
$$;
create function adme_ops.require_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns void language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  retry := adme_ops.take_quota(p_scope,p_subject,p_limit,p_window,p_cost);
  if retry>0 then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','PT429','message','request limit reached',
        'details',jsonb_build_object('retryAfter',retry)::text)::text,
      detail=jsonb_build_object('status',429,'headers',jsonb_build_object('Retry-After',retry::text))::text;
  end if;
end;
$$;
revoke all on function adme_ops.take_quota(text,text,int,int,int),adme_ops.require_quota(text,text,int,int,int)
  from public,anon,authenticated,service_role;

-- Deliberately no caller-controlled subject, limit or window.
create function adme_ops.ops_request_quota(p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_action='draft_poll' then
    retry:=adme_ops.take_quota('draft_poll',auth.uid()::text,120,60);
  else raise invalid_parameter_value; end if;
  return jsonb_build_object('allowed',retry=0,'retryAfter',retry);
end;
$$;
create function public.ops_request_quota(p_action text) returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_request_quota($1); $$;
revoke all on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) from public,anon,authenticated;
grant execute on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) to authenticated;

create function adme_ops.limit_private_writes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Only developer/owner maintenance can omit a JWT; browser/service requests cannot.
  if auth.uid() is null and session_user in ('postgres','supabase_admin') then return new; end if;
  if auth.uid() is null then raise insufficient_privilege; end if;
  if tg_table_name='messages' then
    if new.sender_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('message_minute',auth.uid()::text,20,60);
    perform adme_ops.require_quota('message_day',auth.uid()::text,200,86400);
  elsif tg_table_name='reports' then
    if new.reporter_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('report_hour',auth.uid()::text,5,3600);
    perform adme_ops.require_quota('report_day',auth.uid()::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_private_writes() from public,anon,authenticated;
create trigger message_rate_limit before insert on public.messages for each row execute function adme_ops.limit_private_writes();
create trigger report_rate_limit before insert on public.reports for each row execute function adme_ops.limit_private_writes();

create function adme_ops.limit_job_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not adme_ops.job_enabled(new.kind) then raise sqlstate 'PT404' using message='feature disabled'; end if;
  if new.kind='marketing_draft' then
    perform adme_ops.require_quota('draft_day',new.owner_id::text,10,86400);
  elsif new.kind='youtube_claim' then
    perform adme_ops.require_quota('claim_day',new.owner_id::text,5,86400);
  elsif new.kind='youtube_channel' then
    perform adme_ops.require_quota('manual_channel_day',new.owner_id::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_job_enqueue() from public,anon,authenticated;
create trigger ops_job_rate_limit before insert on adme_ops.jobs for each row execute function adme_ops.limit_job_enqueue();

-- Reserve a conservative provider/model budget BEFORE returning a lease.
-- A retry consumes another reservation; provider errors never refund a reservation.
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job adme_ops.jobs; keyword text; retry int; cost int; provider text;
begin
  perform adme_ops.verify_worker(p_token);
  delete from adme_ops.rate_windows where window_start<now()-interval '2 days';
  update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='LEASE_EXPIRED',finished_at=now()
    where status='running' and lease_until<=now() and attempts>=3;
  for iteration in 1..10 loop
    select * into job from adme_ops.jobs
      where adme_ops.job_enabled(kind) and ((status='queued' and available_at<=now() and attempts<3)
        or (status='running' and lease_until<=now() and attempts<3))
      order by created_at,id for update skip locked limit 1;
    if not found then return null; end if;
    provider:=case when job.kind='marketing_draft' then 'local_llm' else 'youtube' end;
    -- Daily: 100 search + 1 channels + <=25 playlists + <=3 videos = <=129 units.
    cost:=case job.kind when 'youtube_daily' then 130 when 'youtube_channel' then 3 else 1 end;
    retry:=adme_ops.take_quota('provider_day',provider,case when provider='youtube' then 1000 else 30 end,86400,cost);
    if retry>0 then
      update adme_ops.jobs set status='queued',available_at=now()+make_interval(secs=>retry),
        lease=null,lease_until=null,error_code='LOCAL_BUDGET' where id=job.id;
      continue;
    end if;
    update adme_ops.jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '6 minutes'
      where id=job.id returning * into job;
    select discovery_keyword into keyword from adme_ops.settings where discovery_enabled;
    return jsonb_build_object('id',job.id,'kind',job.kind,'input',job.input,'lease',job.lease,
      'keyword',keyword,'refresh',case when job.kind='youtube_daily' and keyword is not null then
        (select coalesce(jsonb_agg(channel_id),'[]') from
          (select channel_id from adme_ops.channels order by fetched_at,channel_id limit 20) c) end);
  end loop;
  return null;
end;
$$;
select cron.schedule('adme-rate-cleanup','15 20 * * *',
  'delete from adme_ops.rate_windows where window_start < now() - interval ''2 days''');
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200007','rate_limits',array[$adme_schema_packet$-- D076: atomic shared quotas. All subjects/limits are chosen on the server/DB.
begin;
-- New provider/model work is opt-in at the DB boundary as well as the app.
create table adme_ops.resource_controls (
  singleton boolean primary key default true check(singleton),
  ingestion_enabled boolean not null default false,
  llm_enabled boolean not null default false
);
insert into adme_ops.resource_controls default values;
alter table adme_ops.resource_controls enable row level security;
revoke all on adme_ops.resource_controls from public,anon,authenticated,service_role;
create function adme_ops.job_enabled(p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select case when p_kind='marketing_draft' then llm_enabled
    when p_kind in ('youtube_channel','youtube_daily','youtube_claim') then ingestion_enabled else false end
    from adme_ops.resource_controls where singleton),false);
$$;
revoke all on function adme_ops.job_enabled(text) from public,anon,authenticated,service_role;
update adme_ops.settings set discovery_enabled=false where singleton=true;
create function adme_ops.guard_discovery_enable() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.discovery_enabled and not adme_ops.job_enabled('youtube_daily') then
    raise sqlstate 'PT404' using message='feature disabled';
  end if;
  return new;
end;
$$;
create function adme_ops.pause_discovery() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not new.ingestion_enabled then update adme_ops.settings set discovery_enabled=false where singleton=true; end if;
  return new;
end;
$$;
revoke all on function adme_ops.guard_discovery_enable(),adme_ops.pause_discovery() from public,anon,authenticated;
create trigger ops_discovery_gate before update on adme_ops.settings for each row execute function adme_ops.guard_discovery_enable();
create trigger ops_resource_pause after update on adme_ops.resource_controls for each row execute function adme_ops.pause_discovery();
create table adme_ops.rate_windows (
  scope text not null,
  subject text not null,
  window_start timestamptz not null,
  used integer not null check(used>0),
  primary key(scope,subject,window_start)
);
alter table adme_ops.rate_windows enable row level security;
revoke all on adme_ops.rate_windows from public,anon,authenticated,service_role;
create index ops_rate_expiry on adme_ops.rate_windows(window_start);

create function adme_ops.take_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns int language plpgsql security definer set search_path='' as $$
declare start_at timestamptz; accepted int;
begin
  if p_scope is null or length(p_scope) not between 1 and 80
     or p_subject is null or length(p_subject) not between 1 and 100
     or p_limit is null or p_limit not between 1 and 100000
     or p_window is null or p_window not between 1 and 86400
     or p_cost is null or p_cost not between 1 and p_limit then raise invalid_parameter_value; end if;
  start_at := to_timestamp(floor(extract(epoch from statement_timestamp())/p_window)*p_window);
  insert into adme_ops.rate_windows(scope,subject,window_start,used)
    values(p_scope,p_subject,start_at,p_cost)
    on conflict(scope,subject,window_start) do update set used=adme_ops.rate_windows.used+excluded.used
      where adme_ops.rate_windows.used+excluded.used<=p_limit
    returning used into accepted;
  if accepted is not null then return 0; end if;
  return greatest(1,ceil(extract(epoch from start_at+make_interval(secs=>p_window)-statement_timestamp()))::int);
end;
$$;
create function adme_ops.require_quota(p_scope text,p_subject text,p_limit int,p_window int,p_cost int default 1)
returns void language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  retry := adme_ops.take_quota(p_scope,p_subject,p_limit,p_window,p_cost);
  if retry>0 then
    raise sqlstate 'PGRST' using
      message=jsonb_build_object('code','PT429','message','request limit reached',
        'details',jsonb_build_object('retryAfter',retry)::text)::text,
      detail=jsonb_build_object('status',429,'headers',jsonb_build_object('Retry-After',retry::text))::text;
  end if;
end;
$$;
revoke all on function adme_ops.take_quota(text,text,int,int,int),adme_ops.require_quota(text,text,int,int,int)
  from public,anon,authenticated,service_role;

-- Deliberately no caller-controlled subject, limit or window.
create function adme_ops.ops_request_quota(p_action text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare retry int;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if p_action='draft_poll' then
    retry:=adme_ops.take_quota('draft_poll',auth.uid()::text,120,60);
  else raise invalid_parameter_value; end if;
  return jsonb_build_object('allowed',retry=0,'retryAfter',retry);
end;
$$;
create function public.ops_request_quota(p_action text) returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_request_quota($1); $$;
revoke all on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) from public,anon,authenticated;
grant execute on function adme_ops.ops_request_quota(text),public.ops_request_quota(text) to authenticated;

create function adme_ops.limit_private_writes() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  -- Only developer/owner maintenance can omit a JWT; browser/service requests cannot.
  if auth.uid() is null and session_user in ('postgres','supabase_admin') then return new; end if;
  if auth.uid() is null then raise insufficient_privilege; end if;
  if tg_table_name='messages' then
    if new.sender_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('message_minute',auth.uid()::text,20,60);
    perform adme_ops.require_quota('message_day',auth.uid()::text,200,86400);
  elsif tg_table_name='reports' then
    if new.reporter_id<>auth.uid() then raise insufficient_privilege; end if;
    perform adme_ops.require_quota('report_hour',auth.uid()::text,5,3600);
    perform adme_ops.require_quota('report_day',auth.uid()::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_private_writes() from public,anon,authenticated;
create trigger message_rate_limit before insert on public.messages for each row execute function adme_ops.limit_private_writes();
create trigger report_rate_limit before insert on public.reports for each row execute function adme_ops.limit_private_writes();

create function adme_ops.limit_job_enqueue() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not adme_ops.job_enabled(new.kind) then raise sqlstate 'PT404' using message='feature disabled'; end if;
  if new.kind='marketing_draft' then
    perform adme_ops.require_quota('draft_day',new.owner_id::text,10,86400);
  elsif new.kind='youtube_claim' then
    perform adme_ops.require_quota('claim_day',new.owner_id::text,5,86400);
  elsif new.kind='youtube_channel' then
    perform adme_ops.require_quota('manual_channel_day',new.owner_id::text,10,86400);
  end if;
  return new;
end;
$$;
revoke all on function adme_ops.limit_job_enqueue() from public,anon,authenticated;
create trigger ops_job_rate_limit before insert on adme_ops.jobs for each row execute function adme_ops.limit_job_enqueue();

-- Reserve a conservative provider/model budget BEFORE returning a lease.
-- A retry consumes another reservation; provider errors never refund a reservation.
create or replace function adme_ops.ops_worker_claim(p_token text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare job adme_ops.jobs; keyword text; retry int; cost int; provider text;
begin
  perform adme_ops.verify_worker(p_token);
  delete from adme_ops.rate_windows where window_start<now()-interval '2 days';
  update adme_ops.jobs set status='failed',lease=null,lease_until=null,error_code='LEASE_EXPIRED',finished_at=now()
    where status='running' and lease_until<=now() and attempts>=3;
  for iteration in 1..10 loop
    select * into job from adme_ops.jobs
      where adme_ops.job_enabled(kind) and ((status='queued' and available_at<=now() and attempts<3)
        or (status='running' and lease_until<=now() and attempts<3))
      order by created_at,id for update skip locked limit 1;
    if not found then return null; end if;
    provider:=case when job.kind='marketing_draft' then 'local_llm' else 'youtube' end;
    -- Daily: 100 search + 1 channels + <=25 playlists + <=3 videos = <=129 units.
    cost:=case job.kind when 'youtube_daily' then 130 when 'youtube_channel' then 3 else 1 end;
    retry:=adme_ops.take_quota('provider_day',provider,case when provider='youtube' then 1000 else 30 end,86400,cost);
    if retry>0 then
      update adme_ops.jobs set status='queued',available_at=now()+make_interval(secs=>retry),
        lease=null,lease_until=null,error_code='LOCAL_BUDGET' where id=job.id;
      continue;
    end if;
    update adme_ops.jobs set status='running',attempts=attempts+1,lease=gen_random_uuid(),lease_until=now()+interval '6 minutes'
      where id=job.id returning * into job;
    select discovery_keyword into keyword from adme_ops.settings where discovery_enabled;
    return jsonb_build_object('id',job.id,'kind',job.kind,'input',job.input,'lease',job.lease,
      'keyword',keyword,'refresh',case when job.kind='youtube_daily' and keyword is not null then
        (select coalesce(jsonb_agg(channel_id),'[]') from
          (select channel_id from adme_ops.channels order by fetched_at,channel_id limit 20) c) end);
  end loop;
  return null;
end;
$$;
select cron.schedule('adme-rate-cleanup','15 20 * * *',
  'delete from adme_ops.rate_windows where window_start < now() - interval ''2 days''');
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): b55fbc756ebd7637df109b29d30468d1c9f07ffdf5d3ed1850c13aca493d139d
-- D059 bridge: upstream directory must honor the independent moderation lock.
begin;
create or replace function adme_ops.ops_public_channels(p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform adme_ops.require_quota('youtube_search',coalesce(auth.uid()::text,'anonymous-shared'),
    case when auth.uid() is null then 300 else 60 end,60);
  return (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from (
    select ch.channel_id,ch.title,ch.subscriber_count,ch.fetched_at,creator.id as creator_id
    from adme_ops.channels ch join adme_ops.channel_claims c using(channel_id)
    join public.creators creator on creator.owner_id=c.owner_id and creator.published
      and creator.moderation_status='allowed' and coalesce(creator.profile->>'is_demo','false')='false'
    where ch.review='accepted' and ch.fetched_at>now()-interval '30 days'
      and c.verified_at is not null and c.consent_at is not null
      and strpos(lower(ch.title),lower(left(coalesce(p_query,''),80)))>0
    order by ch.title,ch.channel_id limit 50
  ) r);
end;
$$;
create or replace function public.ops_public_channels(p_query text default '') returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_public_channels($1); $$;
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200008','youtube_moderation',array[$adme_schema_packet$-- D059 bridge: upstream directory must honor the independent moderation lock.
begin;
create or replace function adme_ops.ops_public_channels(p_query text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform adme_ops.require_quota('youtube_search',coalesce(auth.uid()::text,'anonymous-shared'),
    case when auth.uid() is null then 300 else 60 end,60);
  return (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from (
    select ch.channel_id,ch.title,ch.subscriber_count,ch.fetched_at,creator.id as creator_id
    from adme_ops.channels ch join adme_ops.channel_claims c using(channel_id)
    join public.creators creator on creator.owner_id=c.owner_id and creator.published
      and creator.moderation_status='allowed' and coalesce(creator.profile->>'is_demo','false')='false'
    where ch.review='accepted' and ch.fetched_at>now()-interval '30 days'
      and c.verified_at is not null and c.consent_at is not null
      and strpos(lower(ch.title),lower(left(coalesce(p_query,''),80)))>0
    order by ch.title,ch.channel_id limit 50
  ) r);
end;
$$;
create or replace function public.ops_public_channels(p_query text default '') returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.ops_public_channels($1); $$;
commit;
$adme_schema_packet$]);
commit;

-- Source SHA-256 (UTF-8, LF): 93bfd5d3804fc7ada4f7d41e19f92873a21c111aafc9332f18784969f4bdba48
-- D051: qualify the outer message kind. Bare `kind` bound to proposals.kind.
begin;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  messages.sender_id=auth.uid() and exists (
    select 1 from public.proposals p
    where p.id=messages.proposal_id and auth.uid() in (p.brand_id,p.creator_user_id)
      and p.status<>'rejected'
      and (messages.kind='message' or (p.creator_user_id=auth.uid()
        and p.status in ('accepted','revision_requested') and messages.kind='deliverable'))
  )
);
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200010','message_policy',array[$adme_schema_packet$-- D051: qualify the outer message kind. Bare `kind` bound to proposals.kind.
begin;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  messages.sender_id=auth.uid() and exists (
    select 1 from public.proposals p
    where p.id=messages.proposal_id and auth.uid() in (p.brand_id,p.creator_user_id)
      and p.status<>'rejected'
      and (messages.kind='message' or (p.creator_user_id=auth.uid()
        and p.status in ('accepted','revision_requested') and messages.kind='deliverable'))
  )
);
commit;
$adme_schema_packet$]);
commit;

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
