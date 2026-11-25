-- D055: brand-side recruitment-end reminder (campaign subject, owner only).
-- The effective close is the earlier of recruit_until and terms.recruitment.end, the same pair the D043
-- application gate checks. Collaboration reminders (production/posting) are unchanged.
begin;
alter table public.notifications
 add column campaign_id uuid references public.campaigns(id) on delete cascade,
 drop constraint notifications_subject,
 add constraint notifications_subject check(case
  when kind='saved_search' then proposal_id is null and campaign_id is null and saved_search_id is not null and new_count is not null and due_at is null
  when kind='deadline' and status='recruitment' then proposal_id is null and campaign_id is not null and saved_search_id is null and new_count is null and due_at is not null
  when kind='deadline' then proposal_id is not null and campaign_id is null and saved_search_id is null and new_count is null and due_at is not null
   and status in('production','posting')
  else proposal_id is not null and campaign_id is null and saved_search_id is null and new_count is null and due_at is null end);
create index notifications_campaign on public.notifications(campaign_id) where campaign_id is not null;

drop policy notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using(
 user_id=auth.uid() and(
  (kind='saved_search' and public.account_access())
  or exists(select 1 from public.proposals p where p.id=notifications.proposal_id and auth.uid() in(p.brand_id,p.creator_user_id))
  or exists(select 1 from public.campaigns c where c.id=notifications.campaign_id and c.owner_id=auth.uid())));

create or replace function adme_ops.scan_deadline_reminders(p_now timestamptz default statement_timestamp())returns int
language plpgsql security definer set search_path=''as $$
declare n int; m int;
begin
 if not pg_try_advisory_xact_lock(hashtext('adme-deadline-reminders'))then return 0;end if;
 with due as(
  select p.id proposal_id,m.key milestone,(c.brief->'terms'->m.key->>'end')::timestamptz due_at,p.brand_id,p.creator_user_id
  from public.proposals p join public.campaigns c on c.id=p.campaign_id
  cross join(values('production'),('posting'))m(key)
  where p.status in('accepted','submitted','revision_requested')and not c.is_demo
   and jsonb_typeof(c.brief->'terms'->m.key->'end')='string')
 insert into public.notifications(user_id,proposal_id,kind,status,due_at,source_key)
 select u,d.proposal_id,'deadline',d.milestone,d.due_at,
  'deadline:'||d.proposal_id||':'||d.milestone||':'||u||':'||extract(epoch from d.due_at)::bigint
 from due d cross join lateral(values(d.brand_id),(d.creator_user_id))x(u)
 where u is not null and d.due_at>p_now and d.due_at<=p_now+interval '24 hours'
 on conflict(source_key)do nothing;
 get diagnostics n=row_count;
 -- Open, visible, non-demo campaigns only; a closed or hidden campaign has nothing left to recruit.
 with due as(
  select c.id campaign_id,c.owner_id,least(c.recruit_until,(c.brief#>>'{terms,recruitment,end}')::timestamptz)due_at
  from public.campaigns c
  where c.status='published'and c.moderation_status='allowed'and not c.is_demo)
 insert into public.notifications(user_id,campaign_id,kind,status,due_at,source_key)
 select d.owner_id,d.campaign_id,'deadline','recruitment',d.due_at,
  'deadline:campaign:'||d.campaign_id||':recruitment:'||d.owner_id||':'||extract(epoch from d.due_at)::bigint
 from due d
 where d.due_at>p_now and d.due_at<=p_now+interval '24 hours'
 on conflict(source_key)do nothing;
 get diagnostics m=row_count;
 return n+m;
end;$$;
revoke all on function adme_ops.scan_deadline_reminders(timestamptz)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
