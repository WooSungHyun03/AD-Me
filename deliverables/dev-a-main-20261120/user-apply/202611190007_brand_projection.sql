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
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611190007','brand_projection',array[$adme_packet_body$-- D012 forward hardening: owner UUID is private even through direct authenticated REST.
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
$adme_packet_body$]);
commit;
