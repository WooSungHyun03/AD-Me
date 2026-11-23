-- D070: TEST-only HOT promotion served from a separate slot, never from organic search/scoring.
-- The slot DTO is minimal (position, public creator id, name, first category, validity) and every serve is
-- counted per day per entitlement so the owner can see the exposure history.
create table public.promotion_impressions(
  day date not null default (now() at time zone 'Asia/Seoul')::date,
  entitlement_id uuid not null references entitlements(id) on delete cascade,
  n int not null default 0 check (n >= 0),
  primary key (day, entitlement_id)
);
alter table promotion_impressions enable row level security;
create policy promotion_impressions_read on promotion_impressions for select
  using (is_admin() or exists(select 1 from entitlements e where e.id = entitlement_id and e.owner_id = auth.uid()));
revoke insert, update, delete on promotion_impressions from anon, authenticated;

-- Service only (the app decides whether TEST promotions are enabled). Up to 3 slots, one per creator,
-- earliest-starting active entitlement first. p_record counts one impression per slot served.
create function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int, creator_id text, name text, category text, starts_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  return query
  with active as (
    select distinct on (c.id) c.id cid, c.profile, e.id eid, e.starts_at s, e.expires_at x
    from creators c join entitlements e on e.owner_id = c.owner_id and e.sku = 'creator_hot'
    left join orders o on o.id = e.order_id
    where c.published and c.claim_status = 'verified' and entitlement_active(e) and (e.order_id is null or o.status = 'paid')
    order by c.id, e.starts_at
  ), picked as (
    select row_number() over (order by s, cid)::int pos, * from active order by s, cid limit 3
  ), counted as (
    insert into promotion_impressions as pi (entitlement_id, n)
    select eid, 1 from picked where p_record
    on conflict (day, entitlement_id) do update set n = pi.n + 1
    returning 1
  )
  select p.pos, p.cid, (p.profile->>'name')::text, (p.profile->'categories'->>0)::text, p.s, p.x
  from picked p, (select count(*) from counted) _ order by p.pos;
end $$;
revoke all on function public.serve_promotion_slots(boolean) from public, anon, authenticated;
grant execute on function public.serve_promotion_slots(boolean) to service_role;

-- The old public RPC returned the whole profile JSON; it is no longer callable by clients.
revoke execute on function public.active_hot_creators() from public, anon, authenticated;
