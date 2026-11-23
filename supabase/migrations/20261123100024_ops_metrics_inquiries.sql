-- D063: operating metrics with stated definitions/period, error counts, and a help/contact inbox.
-- Test accounts = emails on reserved domains (RFC 2606/6761: example.com/net/org, .test, .example, .invalid,
-- .localhost) — these can never be real users. Demo campaigns (is_demo) are excluded too.
create function public.is_test_email(p_email text) returns boolean language sql immutable set search_path=public as $$
  select coalesce(lower(p_email) ~ '@([a-z0-9-]+\.)*(example\.(com|net|org)|test|example|invalid|localhost)$', false)
$$;

-- Server errors per day × route × kind. No message, user or request data (PII-free by construction).
create table public.ops_errors(
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  route text not null check (route ~ '^/[A-Za-z0-9_/\[\].-]{0,120}$'),
  kind text not null check (kind ~ '^[a-z_]{1,20}$'),
  n int not null default 1,
  primary key (day, route, kind)
);
alter table ops_errors enable row level security;
revoke all on ops_errors from anon, authenticated;
create function public.record_error(p_route text, p_kind text) returns void language plpgsql security definer set search_path=public as $$
declare r text := case when p_route ~ '^/[A-Za-z0-9_/\[\].-]{0,120}$' then p_route else '/other' end;
        k text := case when p_kind ~ '^[a-z_]{1,20}$' then p_kind else 'other' end;
begin
  insert into ops_errors(route, kind) values (r, k)
  on conflict (day, route, kind) do update set n = ops_errors.n + 1;
end $$;
revoke all on function public.record_error(text, text) from public, anon, authenticated;
grant execute on function public.record_error(text, text) to service_role;

create table public.inquiries(
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  reply_email text check (reply_email is null or (length(reply_email) <= 254 and reply_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  category text not null check (category in ('usage','account','data','billing','other')),
  message text not null check (length(trim(message)) between 10 and 2000),
  status text not null default 'open' check (status in ('open','answered','closed')),
  answer text check (answer is null or length(answer) <= 2000),
  answered_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_id is not null or reply_email is not null)
);
create index on inquiries(status, created_at);
alter table inquiries enable row level security;
create policy inquiries_own_read on inquiries for select using (user_id = auth.uid());
create policy inquiries_admin_read on inquiries for select using (is_admin());
revoke insert, update, delete on inquiries from anon, authenticated;

-- Service only (the API route). Limits: 5 per account per day; 30 anonymous per hour overall.
create function public.submit_inquiry(p_user uuid, p_email text, p_category text, p_message text) returns uuid
language plpgsql security definer set search_path=public as $$
declare v uuid;
begin
  perform pg_advisory_xact_lock(hashtext('submit_inquiry'));
  if p_user is not null and (select count(*) from inquiries where user_id = p_user and created_at > now() - interval '1 day') >= 5 then
    raise exception 'rate_limited';
  end if;
  if p_user is null and (select count(*) from inquiries where user_id is null and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into inquiries(user_id, reply_email, category, message) values (p_user, nullif(p_email, ''), p_category, p_message) returning id into v;
  return v;
end $$;
revoke all on function public.submit_inquiry(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_inquiry(uuid, text, text, text) to service_role;

create function public.answer_inquiry(p_id uuid, p_answer text, p_close boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if length(trim(coalesce(p_answer, ''))) = 0 and not p_close then raise exception 'answer_required'; end if;
  update inquiries set answer = nullif(trim(p_answer), ''), status = case when p_close then 'closed' else 'answered' end,
    answered_at = now() where id = p_id and status <> 'closed';
  if not found then raise exception 'not_found'; end if;
  insert into audit_log(actor_id, entity_id, action) values (auth.uid(), p_id::text, 'inquiry:' || case when p_close then 'closed' else 'answered' end);
end $$;
revoke all on function public.answer_inquiry(uuid, text, boolean) from public, anon;
grant execute on function public.answer_inquiry(uuid, text, boolean) to authenticated;

-- Counts only. Period = last p_days days (1–90) up to now. Definitions are shown next to the numbers in /admin.
create function public.ops_metrics(p_days int default 30) returns jsonb language plpgsql stable security definer set search_path=public as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 90); since timestamptz := now() - make_interval(days => d); r jsonb;
begin
  if not (is_admin() or auth.role() = 'service_role') then raise exception 'forbidden' using errcode = '42501'; end if;
  with t as (select id from auth.users where is_test_email(email)),
  real_camp as (select id from campaigns where not is_demo and owner_id not in (select id from t)),
  real_prop as (select p.* from proposals p join real_camp c on c.id = p.campaign_id
                where p.brand_id not in (select id from t) and p.creator_user_id not in (select id from t))
  select jsonb_build_object(
    'period', jsonb_build_object('days', d, 'from', since, 'to', now()),
    'excluded', jsonb_build_object('test_accounts', (select count(*) from t),
                                   'demo_campaigns', (select count(*) from campaigns where is_demo)),
    'activity', jsonb_build_object(
      'signups', (select count(*) from auth.users where created_at >= since and not is_test_email(email)),
      'active_users', (select count(*) from auth.users where last_sign_in_at >= since and not is_test_email(email)),
      'campaigns_created', (select count(*) from campaigns c join real_camp using (id) where c.created_at >= since),
      'proposals_created', (select count(*) from real_prop where created_at >= since),
      'accepted', (select count(distinct e.proposal_id) from proposal_events e join real_prop p on p.id = e.proposal_id
                   where e.to_status = 'accepted' and e.created_at >= since)),
    'reports', jsonb_build_object(
      'received', (select count(*) from reports where created_at >= since and reporter_id not in (select id from t)),
      'closed', (select count(*) from reports where decided_at >= since and status in ('resolved','dismissed')
                 and reporter_id not in (select id from t)),
      'open_overdue', (select count(*) from reports where status in ('pending','in_review') and due_at < now()
                       and reporter_id not in (select id from t)),
      'median_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from decided_at - created_at) / 3600))::numeric, 1)
                       from reports where decided_at >= since and reporter_id not in (select id from t))),
    'errors', jsonb_build_object(
      'total', (select coalesce(sum(n), 0) from ops_errors where day >= (since at time zone 'Asia/Seoul')::date),
      'top', (select coalesce(jsonb_agg(x order by x.n desc), '[]') from (
                select route, kind, sum(n)::int n from ops_errors where day >= (since at time zone 'Asia/Seoul')::date
                group by 1, 2 order by 3 desc limit 5) x)),
    'inquiries', jsonb_build_object(
      'received', (select count(*) from inquiries i where created_at >= since
                   and (i.user_id is null or i.user_id not in (select id from t)) and not is_test_email(i.reply_email)),
      'answered', (select count(*) from inquiries i where answered_at >= since
                   and (i.user_id is null or i.user_id not in (select id from t)) and not is_test_email(i.reply_email)),
      'open', (select count(*) from inquiries i where status = 'open'
               and (i.user_id is null or i.user_id not in (select id from t)) and not is_test_email(i.reply_email)))
  ) into r;
  return r;
end $$;
revoke all on function public.ops_metrics(int) from public, anon;
grant execute on function public.ops_metrics(int) to authenticated, service_role;
