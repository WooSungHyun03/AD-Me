-- Historical reports may reference a removed profile. Keep its archived target on appeals.
begin;
create or replace function public.submit_report(p_kind text, p_creator text, p_reason text, p_source_url text default null,
  p_parent uuid default null) returns table(id uuid, ticket_no text, due_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); target text := p_creator; archived_target text; par reports; owner uuid; r reports;
begin
  if uid is null then raise exception 'forbidden'; end if;
  if p_kind not in ('report','correction','deletion','appeal','impersonation') then raise exception 'invalid_kind'; end if;
  if length(trim(coalesce(p_reason,''))) not between 10 and 2000 then raise exception 'invalid_reason'; end if;
  if (select count(*) from reports x where x.reporter_id = uid and x.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'rate_limited';
  end if;
  if p_kind = 'appeal' then
    select * into par from reports x where x.id = p_parent;
    if not found or par.reporter_id <> uid or par.kind = 'appeal' then raise exception 'forbidden'; end if;
    if par.status not in ('resolved','dismissed') or par.decided_at is null or par.decided_at < now() - interval '30 days' then raise exception 'appeal_closed'; end if;
    if exists(select 1 from reports x where x.parent_id = par.id and x.kind = 'appeal') then raise exception 'duplicate_open'; end if;
    target := par.creator_id;
    archived_target := par.archived_creator_ref;
  else
    if p_parent is not null then raise exception 'invalid_kind'; end if;
    if p_kind in ('report','correction','impersonation') and coalesce(p_source_url,'') not like 'https://%' then raise exception 'invalid_source'; end if;
    if exists(select 1 from reports x where x.reporter_id = uid and x.creator_id = target and x.kind = p_kind
              and x.status in ('pending','in_review')) then
      raise exception 'duplicate_open';
    end if;
  end if;
  if target is not null then
    select c.owner_id into owner from creators c where c.id = target;
    if not found then raise exception 'not_found'; end if;
  elsif archived_target is null then
    raise exception 'not_found';
  end if;
  insert into reports(reporter_id, creator_id, archived_creator_ref, reason, source_url, kind, parent_id, identity_verified, ticket_no, due_at)
  values (uid, target, archived_target, trim(p_reason), nullif(p_source_url,''), p_kind, case when p_kind = 'appeal' then par.id end,
          owner is not null and owner = uid,
          'ADR-' || to_char(now() at time zone 'Asia/Seoul', 'YYMMDD') || '-' || lpad(nextval('report_ticket_seq')::text, 5, '0'),
          now() + case when p_kind = 'deletion' then interval '10 days' else interval '7 days' end)
  returning * into r;
  insert into report_events(report_id, to_status) values (r.id, 'pending');
  return query select r.id, r.ticket_no, r.due_at;
end $$;
commit;
