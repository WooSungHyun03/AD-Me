-- D049 forward gate: initial acceptance must check BOTH parties, including legacy RPCs.
create function adme_ops.guard_proposal_acceptance() returns trigger
language plpgsql security definer set search_path='' as $$
declare reason text;
begin
 if old.status='pending' and new.status='accepted' then
   if not adme_privacy.actor_active(new.brand_id) or not adme_privacy.actor_active(new.creator_user_id) then
     raise insufficient_privilege using message='collaboration unavailable';
   end if;
   reason:=coalesce(public.contact_denied(new.brand_id,new.creator_user_id),public.contact_denied(new.creator_user_id,new.brand_id));
   if reason is not null then raise exception '%',reason; end if;
   if not exists(select 1 from public.creators c join public.campaigns ca on ca.id=new.campaign_id
     where c.id=new.creator_id and c.owner_id=new.creator_user_id and c.published and c.claim_status='verified'
       and c.moderation_status='allowed' and ca.moderation_status='allowed') then
     raise exception 'creator_unavailable';
   end if;
 end if;
 return new;
end $$;
revoke all on function adme_ops.guard_proposal_acceptance() from public,anon,authenticated,service_role;
create trigger proposal_acceptance_eligibility before update of status on public.proposals
for each row execute function adme_ops.guard_proposal_acceptance();
