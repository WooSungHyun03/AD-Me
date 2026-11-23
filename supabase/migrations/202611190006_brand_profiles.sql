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
commit;
