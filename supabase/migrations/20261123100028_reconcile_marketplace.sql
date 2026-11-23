-- Merge of DEV-A main and DEV-B: DEV-B policies (state machine, recruiting, claims, blocks) replaced DEV-A's
-- proposals_insert/messages_insert after renumbering. Re-add DEV-A's marketplace lock and chat safety guards.
begin;
do $$
declare p text;
begin
  select pg_get_expr(polwithcheck, polrelid) into p from pg_policy
   where polname = 'proposals_insert' and polrelid = 'public.proposals'::regclass;
  execute format('alter policy proposals_insert on public.proposals with check ((%s) and not (kind = %L and adme_ops.marketplace_locked(campaign_id)))', p, 'application');
  select pg_get_expr(polwithcheck, polrelid) into p from pg_policy
   where polname = 'messages_insert' and polrelid = 'public.messages'::regclass;
  execute format('alter policy messages_insert on public.messages with check ((%s) and adme_ops.chat_allowed(proposal_id))', p);
end $$;
commit;
