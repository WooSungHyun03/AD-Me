-- DEV-B D062: user blocks and admin contact restrictions apply on SECURITY DEFINER write paths too.
-- guard_contact skipped every insert whose current_user was not authenticated/anon. The current chat
-- (conversation_send) and proposal RPCs run as the function owner, so a restricted or blocked user
-- could still message/propose through them. Direct REST inserts keep the full contact_check
-- (block, restriction and rate limits) unchanged. Definer paths with a signed-in caller now enforce
-- the block/restriction decision only; their own rate limits stay as they are. Owner SQL, service
-- jobs and migrations (no auth.uid()) are unaffected. Grants are unchanged; the two guard triggers are renamed to run first.
begin;
create or replace function public.guard_contact() returns trigger language plpgsql set search_path=public as $$
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
  if current_user in ('authenticated','anon') then
    perform contact_check(tg_table_name, recipient);
  else
    reason := contact_denied(sender, recipient);
    if reason is not null then raise exception '%', reason using errcode = '42501'; end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_contact() from public, anon, authenticated;
-- Run the contact guard before the marketplace/message guards (BEFORE triggers fire in name order),
-- so a blocked or restricted sender gets the block/restriction reason instead of a generic denial.
alter trigger adme_guard_contact on public.messages rename to a00_guard_contact;
alter trigger adme_guard_contact on public.proposals rename to a00_guard_contact;
commit;
