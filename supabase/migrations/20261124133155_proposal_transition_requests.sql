-- D049: retry acknowledgments for initial decisions, without changing legacy/delivery RPCs.
create table adme_ops.proposal_action_receipts(
 actor_id uuid not null references public.profiles(id) on delete cascade,
 request_key uuid not null,
 proposal_id uuid not null references public.proposals(id) on delete cascade,
 expected_status text not null check(expected_status='pending'),
 action text not null check(action in ('accepted','rejected','cancelled')),
 result text not null check(result=action),
 created_at timestamptz not null default now(),
 primary key(actor_id,request_key)
);
alter table adme_ops.proposal_action_receipts enable row level security;
revoke all on adme_ops.proposal_action_receipts from public,anon,authenticated,service_role;
create function public.transition_proposal_request(p_id uuid,p_action text,p_expected text,p_key uuid)
returns text language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); proposal public.proposals; receipt adme_ops.proposal_action_receipts; result text;
begin
 perform adme_privacy.enforce_actor();
 if actor is null then raise insufficient_privilege; end if;
 if p_key is null or p_id is null or p_expected is distinct from 'pending'
   or p_action is null or p_action not in ('accepted','rejected','cancelled') then raise invalid_parameter_value; end if;
 -- One key cannot race into two different proposals/actions. No receipt survives a failed transition.
 perform pg_advisory_xact_lock(hashtextextended('proposal-action:'||actor::text||':'||p_key::text,0));
 select * into proposal from public.proposals where id=p_id for update;
 if not found or actor not in (proposal.brand_id,proposal.creator_user_id) then raise insufficient_privilege; end if;
 select * into receipt from adme_ops.proposal_action_receipts where actor_id=actor and request_key=p_key;
 if found then
   if receipt.proposal_id<>p_id or receipt.action<>p_action or receipt.expected_status<>p_expected then
     raise serialization_failure using message='proposal request conflict';
   end if;
   return receipt.result;
 end if;
 if proposal.status<>p_expected then raise serialization_failure using message='proposal state conflict'; end if;
 result:=public.transition_proposal(p_id,p_action);
 insert into adme_ops.proposal_action_receipts(actor_id,request_key,proposal_id,expected_status,action,result)
 values(actor,p_key,p_id,p_expected,p_action,result);
 return result;
end $$;
revoke all on function public.transition_proposal_request(uuid,text,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.transition_proposal_request(uuid,text,text,uuid) to authenticated;
