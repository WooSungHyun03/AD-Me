-- Merge DEV-A68 with main YouTube marketplace74 without reopening legacy security boundaries.
begin;
create function adme_release.marketplace_order75(p_sku text)returns public.orders language plpgsql security definer set search_path=''as $$
declare item public.products;result public.orders;actor uuid:=auth.uid();
begin
 if not adme_release.billing_enabled()then raise exception 'TEST billing disabled'using errcode='PT404';end if;
 if actor is null or not public.account_access()then raise insufficient_privilege;end if;
 select *into item from public.products where sku=p_sku;
 if not found or public.my_role()is distinct from item.role then raise insufficient_privilege;end if;
 perform pg_advisory_xact_lock(hashtextextended(actor::text||':checkout',0));
 if p_sku in('job_application','creator_hot')and not exists(select 1 from adme_ops.channel_claims where owner_id=actor and verified_at is not null)then raise insufficient_privilege;end if;
 if p_sku in('search_run','job_post','job_application','creator_hot')then
  select *into result from public.orders where owner_id=actor and sku=p_sku and status='pending'and created_at>now()-interval '8 minutes'order by created_at desc limit 1;
  if found then return result;end if;
 end if;
 if(select count(*)from public.orders where owner_id=actor and created_at>now()-interval '1 hour')>=20 then raise program_limit_exceeded;end if;
 insert into public.orders(owner_id,sku,amount)values(actor,item.sku,item.amount)returning *into result;return result;
end;$$;
create or replace function public.create_test_order(p_sku text)returns public.orders language sql security invoker set search_path=''as $$select adme_release.marketplace_order75($1);$$;
revoke all on function adme_release.marketplace_order75(text),public.create_test_order(text),adme_release.create_order(text)from public,anon,authenticated,service_role;
grant execute on function adme_release.marketplace_order75(text),public.create_test_order(text)to authenticated;

create or replace function public.active_hot_creators()returns table(creator_id text,profile jsonb,expires_at timestamptz)language sql stable security definer set search_path=''as $$
 select h.creator_id,h.profile,h.expires_at from adme_creator.hot_catalog()h
 join public.creators c on c.id=adme_creator.resolve_reference(h.creator_id)
 where adme_release.billing_enabled()and c.profile->'platforms'?'youtube'
 and exists(select 1 from adme_ops.channel_claims cl join adme_ops.channels ch using(channel_id)where cl.owner_id=c.owner_id and cl.verified_at is not null and cl.consent_at is not null and ch.review='accepted'and ch.fetched_at>now()-interval '30 days');
$$;
revoke all on function adme_creator.hot_catalog(),public.active_hot_creators()from public,anon,authenticated,service_role;
grant execute on function public.active_hot_creators()to anon,authenticated;

create or replace function adme_ops.chat_allowed(p_id uuid)returns boolean language sql stable security definer set search_path=''as $$
 select public.account_access()and exists(select 1 from public.proposals p where p.id=p_id and auth.uid()in(p.brand_id,p.creator_user_id)and p.status<>'rejected'and(p.status<>'pending'or not adme_ops.marketplace_locked(p.campaign_id))and not exists(select 1 from adme_ops.chat_safety b where b.proposal_id=p_id and b.action='block')and not exists(select 1 from adme_messaging.blocks b where b.proposal_id=p_id));
$$;
create or replace function public.chat_control(p_id uuid,p_action text,p_reason text default '')returns void language plpgsql security definer set search_path=''as $$
begin
 if not coalesce(public.account_access(),false)then raise insufficient_privilege;end if;
 perform adme_ops.chat_control(p_id,p_action,p_reason);
 if p_action in('block','unblock')then perform adme_messaging.block_room(p_id,p_action='block');end if;
end;$$;
create or replace function public.conversation_block(p_proposal uuid,p_blocked boolean)returns boolean language plpgsql security definer set search_path=''as $$
begin
 if not coalesce(public.account_access(),false)then raise insufficient_privilege;end if;
 perform adme_messaging.block_room(p_proposal,p_blocked);
 perform adme_ops.chat_control(p_proposal,case when p_blocked then 'block'else 'unblock'end,'');return p_blocked;
end;$$;
create function adme_messaging.marketplace_guard75()returns trigger language plpgsql security definer set search_path=''as $$
begin
 if auth.uid()is null and session_user='postgres'then return new;end if;
 if not coalesce(adme_ops.chat_allowed(new.proposal_id),false)then raise insufficient_privilege;end if;return new;
end;$$;
create trigger a0_marketplace_guard75 before insert on public.messages for each row execute function adme_messaging.marketplace_guard75();
revoke all on function adme_ops.chat_allowed(uuid),public.chat_control(uuid,text,text),public.conversation_block(uuid,boolean),adme_messaging.marketplace_guard75(),adme_ops.chat_control(uuid,text,text),adme_messaging.block_room(uuid,boolean)from public,anon,authenticated,service_role;
grant execute on function adme_ops.chat_allowed(uuid),public.chat_control(uuid,text,text),public.conversation_block(uuid,boolean)to authenticated;

create policy product_actor_active75 on public.brand_products as restrictive for all to authenticated using(public.account_access())with check(public.account_access());
create policy saved_channel_actor_active75 on public.saved_youtube_channels as restrictive for all to authenticated using(public.account_access())with check(public.account_access());
create policy campaign_moderation75 on public.campaigns as restrictive for select to anon,authenticated using(moderation_status='allowed'or owner_id=auth.uid()or public.is_admin());
alter policy proposals_insert on public.proposals with check(status='pending'and not(kind='application'and adme_ops.marketplace_locked(campaign_id))and adme_creator.proposal_allowed(campaign_id,creator_id,brand_id,creator_user_id,kind));
create or replace function public.create_creator_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text)returns uuid language plpgsql security definer set search_path=''as $$
begin
 if not coalesce(public.account_access(),false)or(p_kind='application'and adme_ops.marketplace_locked(p_campaign))then raise insufficient_privilege;end if;
 return adme_creator.create_proposal(p_campaign,p_creator,p_kind,p_brief);
end;$$;
revoke all on function public.create_creator_proposal(uuid,text,text,text),adme_creator.create_proposal(uuid,text,text,text)from public,anon,authenticated,service_role;
grant execute on function public.create_creator_proposal(uuid,text,text,text)to authenticated;
notify pgrst,'reload schema';
commit;
