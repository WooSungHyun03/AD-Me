-- D052: in-app notifications. One row per source event (unique source_key), a per-user read cursor
-- that only moves forward, and realtime as a refresh signal (permissions are re-checked by RLS on refetch).

create table public.notifications(
  id bigint generated always as identity primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  proposal_id uuid not null references proposals(id) on delete cascade,
  kind text not null check (kind in ('status','message','deliverable')),
  status text,
  source_key text not null unique, -- 'event:<id>' | 'message:<uuid>': a source can never notify twice
  created_at timestamptz not null default now()
);
create index on notifications(user_id, id desc);
alter table notifications enable row level security;
-- Visible only to the recipient while they are still a participant of the proposal.
create policy notifications_read on notifications for select using (
  user_id = auth.uid() and exists(select 1 from proposals p where p.id = proposal_id and auth.uid() in (p.brand_id, p.creator_user_id)));
revoke insert, update, delete on notifications from anon, authenticated;

create table public.notification_cursors(
  user_id uuid primary key references profiles(id) on delete cascade,
  last_read_id bigint not null default 0,
  read_at timestamptz not null default now()
);
alter table notification_cursors enable row level security;
create policy notification_cursors_read on notification_cursors for select using (user_id = auth.uid());
revoke insert, update, delete on notification_cursors from anon, authenticated;

create function public.notify_proposal_event() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into notifications(user_id, proposal_id, kind, status, source_key)
  values (new.recipient_id, new.proposal_id, 'status', new.to_status, 'event:' || new.id)
  on conflict (source_key) do nothing;
  return new;
end $$;
create function public.notify_message() returns trigger language plpgsql security definer set search_path=public as $$
declare p proposals;
begin
  select * into p from proposals where id = new.proposal_id;
  insert into notifications(user_id, proposal_id, kind, source_key)
  values (case when new.sender_id = p.brand_id then p.creator_user_id else p.brand_id end, p.id,
          case when new.kind = 'deliverable' then 'deliverable' else 'message' end, 'message:' || new.id)
  on conflict (source_key) do nothing;
  return new;
end $$;
revoke all on function public.notify_proposal_event(), public.notify_message() from public, anon, authenticated;
-- Earlier (backfilled) history is not turned into notifications; only events from now on.
create trigger adme_notify_event after insert on proposal_events for each row execute function public.notify_proposal_event();
create trigger adme_notify_message after insert on messages for each row execute function public.notify_message();

-- Move the caller's cursor forward to p_upto (default: newest). Never moves back, never past the newest own row.
-- shortcut: ids come from one identity sequence, so a notification committed later with a lower id than the
-- cursor would be counted as read; transactions here are single-statement triggers, upgrade to per-row read
-- flags if notification writes ever become long transactions.
create function public.mark_notifications_read(p_upto bigint default null) returns bigint
language plpgsql security definer set search_path=public as $$
declare newest bigint; target bigint; result bigint;
begin
  if auth.uid() is null then raise exception 'forbidden'; end if;
  select coalesce(max(id), 0) into newest from notifications where user_id = auth.uid();
  target := least(coalesce(p_upto, newest), newest);
  insert into notification_cursors as c(user_id, last_read_id, read_at) values (auth.uid(), greatest(target, 0), now())
  on conflict (user_id) do update
    set last_read_id = greatest(c.last_read_id, excluded.last_read_id),
        read_at = case when excluded.last_read_id > c.last_read_id then now() else c.read_at end
  returning last_read_id into result;
  return result;
end $$;
revoke all on function public.mark_notifications_read(bigint) from public, anon;
grant execute on function public.mark_notifications_read(bigint) to authenticated;

-- Exact unread count under RLS (invoker): only rows the caller may see, newer than the caller's cursor.
create function public.notification_unread() returns int language sql stable set search_path=public as $$
  select count(*)::int from notifications n
  where n.user_id = auth.uid()
    and n.id > coalesce((select last_read_id from notification_cursors where user_id = auth.uid()), 0)
$$;
revoke all on function public.notification_unread() from public, anon;
grant execute on function public.notification_unread() to authenticated;

alter publication supabase_realtime add table notifications, notification_cursors;
