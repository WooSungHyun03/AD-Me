-- DEV-B D062: contact rate limits on SECURITY DEFINER request/message paths.
-- 20261125180000 made guard_contact enforce block/restriction on definer RPC paths
-- (create_creator_proposal, conversation_send) but left their rate limits to the RPCs, which have none.
-- So the D062 anti-spam caps (sender 20 requests/24h, creator 10 unsolicited proposals/hour from any
-- number of accounts, sender 30 messages/10 min, recipient 60 messages/10 min) only applied to direct
-- REST inserts that the product no longer uses. Signed-in callers on definer paths now get the same
-- contact_check (block/restriction already decided first with 42501). Owner SQL / service jobs without
-- an auth user are unchanged.
begin;
create or replace function public.guard_contact() returns trigger language plpgsql set search_path to 'public' as $$
declare sender uuid := auth.uid(); recipient uuid; p proposals; reason text;
begin
  if sender is null then return new; end if;
  if tg_table_name = 'proposals' then
    recipient := case when new.kind = 'proposal' then new.creator_user_id else new.brand_id end;
  else
    select * into p from proposals where id = new.proposal_id; -- RLS: only a participant can see it
    if not found then return new; end if; -- the insert policy/RPC refuses non-participants
    recipient := case when sender = p.brand_id then p.creator_user_id else p.brand_id end;
  end if;
  if current_user not in ('authenticated','anon') then
    reason := contact_denied(sender, recipient);
    if reason is not null then raise exception '%', reason using errcode = '42501'; end if;
  end if;
  perform contact_check(tg_table_name, recipient);
  return new;
end $$;
commit;
