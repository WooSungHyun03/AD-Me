-- Apply only after 00_preflight.sql succeeds. Stop at the first SQL error.
-- Source SHA-256: 09373c91a5fe7b415aa23d56a96dc9c23b5d9fe4e8fca3ac25c946563168919c
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190004','admin_security',array[$adme_packet_migration$-- D016: reserved by DEV-A. Additive, no implicit grandfathering of role-only admins.
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
$adme_packet_migration$]);
commit;

-- Source SHA-256: 2d94f26f37e1804301b18c1143f24bc4cb151a711ddc8b3372d4232f95a62e2d
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190005','moderation_locks',array[$adme_packet_migration$-- D059: owner publication preference and operator lock are independent.
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
$adme_packet_migration$]);
commit;

-- Source SHA-256: 315f1ba58ebc1eefb8907be44498a604626cf35f75cba3e8b7a4755260a85233
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190006','brand_profiles',array[$adme_packet_migration$-- D012 additive public brand / private contact split; logo attachment awaits D027.
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
$adme_packet_migration$]);
commit;

-- Source SHA-256: 6a97a7a086bfc5407b94108336e31b03472f0014a37a618ab15ef5f32ab92cad
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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190007','brand_projection',array[$adme_packet_migration$-- D012 forward hardening: owner UUID is private even through direct authenticated REST.
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
$adme_packet_migration$]);
commit;
