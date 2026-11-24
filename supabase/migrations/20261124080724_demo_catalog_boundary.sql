-- D005: demo publication is an owner-approved environment boundary, independent of billing.
-- Expand first; preserve all legacy rows and private owner/administrator history.
begin;
create table adme_release.catalog_boundary(
  singleton boolean primary key default true check(singleton),
  demo_enabled boolean not null default false,
  release_ref text,
  changed_at timestamptz
);
alter table adme_release.catalog_boundary enable row level security;
revoke all on adme_release.catalog_boundary from public,anon,authenticated,service_role;
insert into adme_release.catalog_boundary(singleton) values(true);
create function adme_release.demo_catalog_enabled() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select demo_enabled from adme_release.catalog_boundary where singleton),false);
$$;
create function adme_release.set_demo_catalog(p_enabled boolean,p_release text) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_enabled is null or p_release is null or length(btrim(p_release)) not between 7 and 100 then raise invalid_parameter_value; end if;
  update adme_release.catalog_boundary set demo_enabled=p_enabled,release_ref=btrim(p_release),changed_at=statement_timestamp() where singleton;
end;
$$;
revoke all on function adme_release.demo_catalog_enabled(),adme_release.set_demo_catalog(boolean,text) from public,anon,authenticated,service_role;
grant execute on function adme_release.demo_catalog_enabled() to anon,authenticated,service_role;

-- Preserve the reviewed text/privacy gate and opaque reference projection.
create or replace function adme_creator.catalog_dto(p_row public.creators) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when (p_row.profile->'is_demo'='false'::jsonb or adme_release.demo_catalog_enabled())
    and adme_creator.safe_public_text(p_row.profile->>'name') and adme_creator.safe_public_text(p_row.profile->>'bio')
    then adme_creator.catalog_dto_legacy_ref(p_row) else null end
    ||jsonb_build_object('seed_id',adme_creator.public_reference(p_row.id));
$$;
revoke all on function adme_creator.catalog_dto(public.creators) from public,anon,authenticated,service_role;

-- Legacy search/count use a separate filter; a forged p_include_demo must not bypass the environment gate.
do $patch$
declare body text; changed text;
begin
  body:=pg_get_functiondef('public.filtered_creators(text,text,text,text,numeric,boolean,numeric,numeric,boolean)'::regprocedure);
  changed:=replace(body,'where c.published','where c.published and adme_creator.catalog_dto(c) is not null');
  if changed=body then raise exception 'STOP: reviewed legacy creator filter required'; end if;
  execute changed;
end;
$patch$;

create policy demo_campaign_public_boundary on public.campaigns as restrictive for select to anon,authenticated
using(not is_demo or adme_release.demo_catalog_enabled() or owner_id=auth.uid() or public.is_admin());
notify pgrst,'reload schema';
commit;
