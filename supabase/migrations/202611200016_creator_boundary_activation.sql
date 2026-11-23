-- Deployment compatibility: secure by default; only the reviewed atomic USER
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
