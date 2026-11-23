-- D075: retain DEV-B's service-only HOT slots with DEV-A publication/opaque-reference gates.
begin;
create or replace function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int,creator_id text,name text,category text,starts_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''as $$
begin
 if not adme_release.billing_enabled()then return;end if;
 return query
 with active as(
  select distinct on(c.id)c.id cid,adme_creator.catalog_dto(c)dto,e.id eid,e.starts_at s,e.expires_at x
  from public.creators c join public.entitlements e on e.owner_id=c.owner_id and e.sku='creator_hot'
  left join public.orders o on o.id=e.order_id
  where c.published and c.claim_status='verified'and adme_creator.catalog_dto(c)is not null and public.entitlement_active(e)and(e.order_id is null or o.status='paid')
  and(coalesce(c.profile->>'is_demo','false')='true'or exists(select 1 from adme_ops.channel_claims claim join adme_ops.channels ch using(channel_id)
   where claim.owner_id=c.owner_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and adme_ops.channel_fresh(ch.channel_id)))
  order by c.id,e.starts_at,e.id
 ),picked as(
  select row_number()over(order by s,cid)::int pos,*from active order by s,cid limit 3
 ),counted as(
  insert into public.promotion_impressions as pi(entitlement_id,n)select eid,1 from picked where coalesce(p_record,false)
  on conflict(day,entitlement_id)do update set n=pi.n+1 returning 1
 )select p.pos,adme_creator.public_reference(p.cid),p.dto->>'name',p.dto->'categories'->>0,p.s,p.x from picked p cross join(select count(*)from counted)q order by p.pos;
end;$$;
revoke all on function public.serve_promotion_slots(boolean)from public,anon,authenticated,service_role;
grant execute on function public.serve_promotion_slots(boolean)to service_role;
-- The retired full-profile client endpoint remains unavailable.
revoke all on function public.active_hot_creators()from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
