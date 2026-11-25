-- D055: in-app deadline reminders for active collaborations.
-- Both sides of an accepted/submitted/revision_requested proposal get one reminder per milestone (production, posting)
-- when its end falls within the next 24 hours. The reminder is keyed by the due time, so a changed schedule reminds
-- once more for the new time and a repeated run never duplicates. Email stays off until D053 (trigger skips the kind).
begin;
alter table public.notifications
 drop constraint notifications_kind_check,
 add constraint notifications_kind_check check(kind in('status','message','deliverable','saved_search','deadline')),
 add column due_at timestamptz,
 drop constraint notifications_subject,
 add constraint notifications_subject check(case
  when kind='saved_search' then proposal_id is null and saved_search_id is not null and new_count is not null and due_at is null
  when kind='deadline' then proposal_id is not null and saved_search_id is null and new_count is null and due_at is not null
   and status in('production','posting')
  else proposal_id is not null and saved_search_id is null and new_count is null and due_at is null end);
drop trigger adme_service_email on public.notifications;
create trigger adme_service_email after insert on public.notifications for each row
 when(new.kind not in('saved_search','deadline'))execute function public.enqueue_service_email();

create function adme_ops.scan_deadline_reminders(p_now timestamptz default statement_timestamp())returns int
language plpgsql security definer set search_path=''as $$
declare n int;
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
 return n;
end;$$;
revoke all on function adme_ops.scan_deadline_reminders(timestamptz)from public,anon,authenticated,service_role;
select cron.schedule('adme-deadline-reminders','5 * * * *','select adme_ops.scan_deadline_reminders()');
notify pgrst,'reload schema';
commit;
