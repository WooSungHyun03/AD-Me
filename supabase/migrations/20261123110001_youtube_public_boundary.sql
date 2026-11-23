-- Keep the new main directory behind the reviewed public-reference, projection and source-TTL contracts.
begin;
do $$declare body text;begin
 body:=pg_get_functiondef('adme_ops.featured_youtube(text,text,integer)'::regprocedure);
 if position('creator.id as creator_id' in body)=0 or position('ch.fetched_at>now()-interval ''30 days''' in body)=0 then raise exception 'STOP: reviewed main directory required';end if;
 body:=replace(body,'creator.id as creator_id','adme_creator.public_reference(creator.id) as creator_id');
 body:=replace(body,'creator.owner_id=claim.owner_id and creator.published','creator.owner_id=claim.owner_id and creator.published and adme_creator.catalog_dto(creator)is not null');
 body:=replace(body,'ch.fetched_at>now()-interval ''30 days''','adme_ops.channel_fresh(ch.channel_id)');
 execute body;
end;$$;
create or replace function adme_ops.creator_youtube_channel(p_creator_id text)returns text language sql stable security definer set search_path=''as $$
 select claim.channel_id from public.creators creator join adme_ops.channel_claims claim on claim.owner_id=creator.owner_id
 where creator.id=adme_creator.resolve_reference(p_creator_id)and adme_creator.catalog_dto(creator)is not null and claim.verified_at is not null and claim.consent_at is not null
 and exists(select 1 from jsonb_array_elements(adme_ops.featured_youtube('',claim.channel_id,1))entry where entry->>'creator_id'=adme_creator.public_reference(creator.id))
 order by claim.verified_at desc,claim.channel_id limit 1;
$$;
create function public.youtube_own_room(p_channel text)returns uuid language sql stable security definer set search_path=''as $$
 select p.id from public.proposals p join public.creators c on c.id=p.creator_id
 where public.account_access()and auth.uid()in(p.brand_id,p.creator_user_id)and p.status in('accepted','submitted','revision_requested','completed')
 and exists(select 1 from jsonb_array_elements(adme_ops.featured_youtube('',p_channel,1))entry where entry->>'creator_id'=adme_creator.public_reference(c.id))
 order by p.updated_at desc,p.id limit 1;
$$;
revoke all on function public.youtube_own_room(text)from public,anon,authenticated,service_role;
grant execute on function public.youtube_own_room(text)to authenticated;
create policy youtube_contact_actor_active78 on public.youtube_channel_contacts as restrictive for all to authenticated using(public.account_access())with check(public.account_access());
notify pgrst,'reload schema';
commit;
