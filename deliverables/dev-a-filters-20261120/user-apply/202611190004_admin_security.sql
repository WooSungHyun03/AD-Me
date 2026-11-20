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
