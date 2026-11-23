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
commit;
