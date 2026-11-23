-- D033: server-side creator search. Keyset pagination with id tie-breaker, public DTO only, capped page size.
create extension if not exists pg_trgm with schema extensions;

create function public.creator_search_text(p jsonb) returns text language sql immutable parallel safe set search_path=public as $$
  select lower(coalesce(p->>'name','')||' '||coalesce(p->>'handle','')||' '||coalesce(p->>'bio','')||' '||coalesce(p->>'vibes',''))
$$;
create function public.creator_price_key(p jsonb) returns numeric language sql immutable parallel safe set search_path=public as $$
  select coalesce((p->>'price_min_krw')::numeric, 1e12) -- unknown quote sorts last
$$;

create index creators_pub_name on creators ((profile->>'name'), id) where published;
create index creators_pub_followers on creators (((profile->>'followers')::numeric) desc, id) where published;
create index creators_pub_price on creators (creator_price_key(profile), id) where published;
create index creators_pub_tags on creators using gin (profile jsonb_path_ops) where published;
create index creators_pub_search on creators using gin (creator_search_text(profile) extensions.gin_trgm_ops) where published;

-- Shared filter. Plain SQL so the planner inlines it and can use the indexes. `published` is always required,
-- so owners/admins never see drafts in public search. Not callable by API roles (it returns raw rows).
create function public.filtered_creators(
  p_q text default null, p_category text default null, p_platform text default null, p_tag text default null,
  p_budget numeric default null, p_available boolean default false,
  p_min_followers numeric default null, p_max_followers numeric default null,
  p_include_demo boolean default false
) returns setof public.creators language sql stable as $$ -- no SET clause: it would block inlining (and index use); names are schema-qualified
  select c.* from public.creators c
  where c.published
    and (p_include_demo or c.profile->>'is_demo' = 'false')
    and (p_q is null or public.creator_search_text(c.profile) like '%'||lower(replace(replace(replace(p_q,'\','\\'),'%','\%'),'_','\_'))||'%')
    and (p_category is null or c.profile @> jsonb_build_object('categories', jsonb_build_array(p_category)))
    and (p_platform is null or c.profile @> jsonb_build_object('platforms', jsonb_build_array(p_platform)))
    and (p_tag is null or c.profile @> jsonb_build_object('vibes', jsonb_build_array(p_tag)))
    and (p_budget is null or (c.profile->>'price_min_krw')::numeric <= p_budget)
    and (not p_available or c.profile @> '{"is_available": true}')
    and (p_min_followers is null or (c.profile->>'followers')::numeric >= p_min_followers)
    and (p_max_followers is null or (c.profile->>'followers')::numeric <= p_max_followers)
$$;

-- Keyset page: (sort key, id) cursor, page size clamped to 1..49 (48 + one look-ahead row), public DTO only (no owner fields).
create function public.search_creators(
  p_q text default null, p_category text default null, p_platform text default null, p_tag text default null,
  p_budget numeric default null, p_available boolean default false,
  p_min_followers numeric default null, p_max_followers numeric default null,
  p_include_demo boolean default false,
  p_sort text default 'name', p_after_key text default null, p_after_id text default null, p_limit int default 24
) returns table(id text, profile jsonb, claim_status text, sort_key text)
-- SECURITY DEFINER on purpose: under RLS, non-leakproof LIKE/@> cannot use the trigram/GIN indexes.
-- Exposure equals creators_read for anon (published rows only) and only the sanitized DTO leaves.
language plpgsql stable security definer set search_path=public, extensions as $$
declare lim int := least(greatest(coalesce(p_limit, 24), 1), 49);
begin
  -- One plain ORDER BY per sort so each matches its (key, id) index.
  if p_sort = 'name' then
    return query select f.id, f.profile - 'owner_id' - 'owner_consent' - 'seed_id', f.claim_status, f.profile->>'name'
      from filtered_creators(p_q,p_category,p_platform,p_tag,p_budget,p_available,p_min_followers,p_max_followers,p_include_demo) f
      where p_after_id is null or (f.profile->>'name', f.id) > (p_after_key, p_after_id)
      order by f.profile->>'name', f.id limit lim;
  elsif p_sort = 'followers' then
    return query select f.id, f.profile - 'owner_id' - 'owner_consent' - 'seed_id', f.claim_status, ((f.profile->>'followers')::numeric)::text
      from filtered_creators(p_q,p_category,p_platform,p_tag,p_budget,p_available,p_min_followers,p_max_followers,p_include_demo) f
      where p_after_id is null or (f.profile->>'followers')::numeric < p_after_key::numeric
        or ((f.profile->>'followers')::numeric = p_after_key::numeric and f.id > p_after_id)
      order by (f.profile->>'followers')::numeric desc, f.id limit lim;
  elsif p_sort = 'price' then
    return query select f.id, f.profile - 'owner_id' - 'owner_consent' - 'seed_id', f.claim_status, creator_price_key(f.profile)::text
      from filtered_creators(p_q,p_category,p_platform,p_tag,p_budget,p_available,p_min_followers,p_max_followers,p_include_demo) f
      where p_after_id is null or (creator_price_key(f.profile), f.id) > (p_after_key::numeric, p_after_id)
      order by creator_price_key(f.profile), f.id limit lim;
  else
    raise exception 'invalid sort';
  end if;
end $$;

-- Total count policy: exact up to 1000; 1001 means "1000+".
create function public.count_creators(
  p_q text default null, p_category text default null, p_platform text default null, p_tag text default null,
  p_budget numeric default null, p_available boolean default false,
  p_min_followers numeric default null, p_max_followers numeric default null,
  p_include_demo boolean default false
) returns int language plpgsql stable security definer set search_path=public, extensions as $$
begin -- plpgsql so the search pattern is planned as a constant (trigram index usable)
  return (select count(*)::int from (select 1 from filtered_creators(p_q,p_category,p_platform,p_tag,p_budget,p_available,p_min_followers,p_max_followers,p_include_demo) limit 1001) x);
end $$;
revoke all on function public.filtered_creators from public, anon, authenticated;
revoke all on function public.search_creators, public.count_creators from public;
grant execute on function public.search_creators, public.count_creators to anon, authenticated;
