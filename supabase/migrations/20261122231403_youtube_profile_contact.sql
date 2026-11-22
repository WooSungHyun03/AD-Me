begin;
create table public.youtube_channel_contacts (
  channel_id text not null check (channel_id ~ '^UC[A-Za-z0-9_-]{22}$'),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  business_email text not null default '' check (length(business_email)<=254 and (business_email='' or business_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$')),
  business_phone text not null default '' check (business_phone='' or business_phone ~ '^[+0-9(). -]{7,30}$'),
  consent boolean not null default false,
  primary key(owner_id,channel_id),
  check (not consent or business_email<>'' or business_phone<>'')
);
alter table public.youtube_channel_contacts enable row level security;
revoke all on public.youtube_channel_contacts from public,anon,authenticated;
grant select,insert,update,delete on public.youtube_channel_contacts to authenticated;
create policy contacts_own on public.youtube_channel_contacts for all to authenticated
  using (owner_id=(select auth.uid()))
  with check (owner_id=(select auth.uid()) and channel_id in (
    select entry->>'channel_id' from jsonb_array_elements(public.ops_own_channels()) entry
    where entry->>'verified'='true'
  ));

create function adme_ops.public_youtube_contact(p_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('email',nullif(contact.business_email,''),'phone',nullif(contact.business_phone,''))
  from public.youtube_channel_contacts contact
  join adme_ops.channel_claims claim using(channel_id,owner_id)
  where contact.channel_id=p_id and contact.consent and claim.verified_at is not null and claim.consent_at is not null
    and exists(
      select 1 from jsonb_array_elements(adme_ops.featured_youtube('',p_id,1)) entry
      where entry->>'creator_id' is not null
    );
$$;
create function public.public_youtube_contact(p_id text) returns jsonb
language sql stable security invoker set search_path='' as $$
  select adme_ops.public_youtube_contact(p_id);
$$;
create function adme_ops.creator_youtube_channel(p_creator_id text) returns text
language sql stable security definer set search_path='' as $$
  select claim.channel_id
  from public.creators creator
  join adme_ops.channel_claims claim on claim.owner_id=creator.owner_id
  where creator.id=p_creator_id and creator.published and claim.verified_at is not null and claim.consent_at is not null
    and exists (
      select 1 from jsonb_array_elements(adme_ops.featured_youtube('',claim.channel_id,1)) entry
      where entry->>'creator_id'=p_creator_id
    )
  order by claim.verified_at desc, claim.channel_id limit 1;
$$;
create function public.creator_youtube_channel(p_creator_id text) returns text
language sql stable security invoker set search_path='' as $$
  select adme_ops.creator_youtube_channel(p_creator_id);
$$;
revoke all on function adme_ops.public_youtube_contact(text),public.public_youtube_contact(text),
  adme_ops.creator_youtube_channel(text),public.creator_youtube_channel(text) from public,anon,authenticated;
grant execute on function adme_ops.public_youtube_contact(text),public.public_youtube_contact(text),
  adme_ops.creator_youtube_channel(text),public.creator_youtube_channel(text) to anon,authenticated;
commit;
