-- Source SHA-256 (UTF-8, LF): 93bfd5d3804fc7ada4f7d41e19f92873a21c111aafc9332f18784969f4bdba48
-- D051: qualify the outer message kind. Bare `kind` bound to proposals.kind.
begin;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  messages.sender_id=auth.uid() and exists (
    select 1 from public.proposals p
    where p.id=messages.proposal_id and auth.uid() in (p.brand_id,p.creator_user_id)
      and p.status<>'rejected'
      and (messages.kind='message' or (p.creator_user_id=auth.uid()
        and p.status in ('accepted','revision_requested') and messages.kind='deliverable'))
  )
);
insert into supabase_migrations.schema_migrations(version,name,statements) values ('202611200010','message_policy',array[$adme_schema_packet$-- D051: qualify the outer message kind. Bare `kind` bound to proposals.kind.
begin;
drop policy messages_insert on public.messages;
create policy messages_insert on public.messages for insert with check (
  messages.sender_id=auth.uid() and exists (
    select 1 from public.proposals p
    where p.id=messages.proposal_id and auth.uid() in (p.brand_id,p.creator_user_id)
      and p.status<>'rejected'
      and (messages.kind='message' or (p.creator_user_id=auth.uid()
        and p.status in ('accepted','revision_requested') and messages.kind='deliverable'))
  )
);
commit;
$adme_schema_packet$]);
commit;
