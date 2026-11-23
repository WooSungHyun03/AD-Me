-- D048: LLM cost control. Daily per-user and global call caps, reserved atomically BEFORE a provider call;
-- token usage recorded after. Counts only — prompts and outputs are never stored.
create table public.ai_usage(
  user_id uuid not null references profiles(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  calls int not null default 0 check (calls >= 0),
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  primary key (user_id, day)
);
alter table ai_usage enable row level security;
create policy ai_usage_own_read on ai_usage for select using (user_id = auth.uid());
revoke insert, update, delete on ai_usage from anon, authenticated;

-- true = a call slot was reserved. Serialized so the global cap cannot be overrun by concurrent requests.
create function public.reserve_ai_call(p_user uuid, p_user_limit int, p_global_limit int) returns boolean
language plpgsql security definer set search_path=public as $$
declare d date := (now() at time zone 'Asia/Seoul')::date;
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('ai_usage'));
  if coalesce((select sum(calls) from ai_usage where day = d), 0) >= p_global_limit then return false; end if;
  if coalesce((select calls from ai_usage where user_id = p_user and day = d), 0) >= p_user_limit then return false; end if;
  insert into ai_usage(user_id, day, calls) values (p_user, d, 1)
    on conflict (user_id, day) do update set calls = ai_usage.calls + 1;
  return true;
end $$;
create function public.record_ai_tokens(p_user uuid, p_in int, p_out int) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  update ai_usage set input_tokens = input_tokens + greatest(p_in, 0), output_tokens = output_tokens + greatest(p_out, 0)
   where user_id = p_user and day = (now() at time zone 'Asia/Seoul')::date;
end $$;
revoke all on function public.reserve_ai_call(uuid, int, int) from public, anon, authenticated;
revoke all on function public.record_ai_tokens(uuid, int, int) from public, anon, authenticated;
grant execute on function public.reserve_ai_call(uuid, int, int) to service_role;
grant execute on function public.record_ai_tokens(uuid, int, int) to service_role;
