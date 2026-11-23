-- D075/D018: preserve legacy IDs and private workflows while closing raw public reads.
begin;
create function adme_creator.public_https(p_value text) returns text
language plpgsql immutable set search_path='' as $$
declare authority text; port_value text;
begin
  if p_value is null or length(p_value)>2000 or
    p_value !~ '^https://([^@/:?#[:space:]\\]+|\[[A-Fa-f0-9:.]+\])(:[0-9]{1,5})?([/?#][^[:space:]\\]*)?$' then return null; end if;
  authority:=substring(p_value from '^https://([^/?#]+)');
  port_value:=substring(authority from ':([0-9]{1,5})$');
  if port_value is not null and port_value::int>65535 then return null; end if;
  return p_value;
end;
$$;
create function adme_creator.public_social(p_value text) returns text
language sql immutable set search_path='' as $$
  select case when adme_creator.public_https(p_value) is not null and (
    p_value ~ '^https://www\.youtube\.com/(watch\?v=[A-Za-z0-9_-]{11}|channel/UC[A-Za-z0-9_-]{22}|@[A-Za-z0-9_.%~-]+)$'
    or p_value ~ '^https://www\.instagram\.com/([A-Za-z0-9_.]{1,30}|(p|reel)/[A-Za-z0-9_-]{1,32})/$'
    or p_value ~ '^https://www\.tiktok\.com/@[A-Za-z0-9_.]{1,24}(/video/[0-9]{1,25})?$'
  ) then p_value else null end;
$$;
create function adme_creator.catalog_dto(p_row public.creators) returns jsonb
language plpgsql immutable set search_path='' as $$
declare p jsonb:=p_row.profile; social text; portfolio text; synthetic boolean; field_name text;
begin
  if not p_row.published or p_row.moderation_status<>'allowed' or not public.valid_creator_dto(p) then return null; end if;
  foreach field_name in array array['categories','vibes','formats','platforms'] loop
    if exists(select 1 from jsonb_array_elements_text(p->field_name) v where length(v)>50) then return null; end if;
  end loop;
  if (p->>'price_min_krw')::numeric<>trunc((p->>'price_min_krw')::numeric)
    or (p->>'price_max_krw')::numeric<>trunc((p->>'price_max_krw')::numeric) then return null; end if;
  synthetic:=p->'is_demo'='true'::jsonb and p->>'metrics_source'='synthetic_demo_not_verified';
  if synthetic and (p->>'followers')::numeric<>trunc((p->>'followers')::numeric) then return null; end if;
  if p->'owner_consent'='true'::jsonb then
    social:=adme_creator.public_social(p->>'social_url');
    portfolio:=adme_creator.public_https(p->>'portfolio_url');
  end if;
  return jsonb_build_object('seed_id',p_row.id,'name',p->'name','handle',p->'handle','bio',p->'bio',
    'categories',p->'categories','vibes',p->'vibes','formats',p->'formats','platforms',p->'platforms',
    'price_min_krw',p->'price_min_krw','price_max_krw',p->'price_max_krw',
    'followers',case when synthetic then p->'followers' else 'null'::jsonb end,
    'metrics_source',case when synthetic then 'synthetic_demo_not_verified' else 'unavailable' end,
    'is_available',p->'is_available','is_demo',p->'is_demo',
    'data_source',case when p->'is_demo'='true'::jsonb then 'generated fictional test fixture' else 'owner_registration' end,
    'source_url',social,'portrait_asset',null,'image_placeholder',case when p->'is_demo'='true'::jsonb then 'gradient_initials' else 'initials' end,
    'published',true) || case when social is null then '{}'::jsonb else jsonb_build_object('social_url',social) end
    || case when portfolio is null then '{}'::jsonb else jsonb_build_object('portfolio_url',portfolio) end;
end;
$$;
revoke all on function adme_creator.public_https(text),adme_creator.public_social(text),adme_creator.catalog_dto(public.creators) from public,anon,authenticated,service_role;

-- The present UI still filters a bounded snapshot. This cursor is compatibility
-- pagination, not D033's completed indexed server search/filter API.
create function adme_creator.catalog_page(p_after text,p_limit int) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if p_after is null or length(p_after)>100 or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid catalog window' using errcode='22023'; end if;
  with source as (
    select c.id,adme_creator.catalog_dto(c) dto from public.creators c
    where c.published and c.moderation_status='allowed' and c.id collate "C">p_after collate "C"
      and adme_creator.catalog_dto(c) is not null order by c.id collate "C" limit p_limit+1
  ), numbered as (select *,row_number() over(order by id collate "C") n from source)
  select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(dto order by id collate "C") filter(where n<=p_limit),'[]'::jsonb),
    'nextCursor',case when count(*)>p_limit then max(id collate "C") filter(where n<=p_limit) else null end) into result from numbered;
  return result;
end;
$$;
create function public.creator_catalog_page(p_after text default '',p_limit int default 100) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.catalog_page($1,$2); $$;
grant usage on schema adme_creator to anon;
revoke all on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) from public,anon,authenticated,service_role;
grant execute on function adme_creator.catalog_page(text,int),public.creator_catalog_page(text,int) to anon,authenticated;

create function adme_creator.saved_catalog() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('creator_id',s.creator_id,'creator',adme_creator.catalog_dto(c)) order by s.creator_id collate "C")
    from public.saved_creators s join public.creators c on c.id=s.creator_id where s.owner_id=auth.uid()),'[]'::jsonb);
end;
$$;
create function public.my_saved_creator_catalog() returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.saved_catalog(); $$;
revoke all on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),public.my_saved_creator_catalog() to authenticated;

create function adme_creator.proposal_choices(p_campaign uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare campaign public.campaigns;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into campaign from public.campaigns where id=p_campaign and moderation_status='allowed';
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.profile->>'name') order by c.id collate "C")
    from public.creators c where c.published and c.moderation_status='allowed' and c.owner_id is not null and
      ((campaign.owner_id=auth.uid() and public.my_role()='brand') or
        (campaign.status='published' and c.owner_id=auth.uid() and public.my_role()='creator'))),'[]'::jsonb);
end;
$$;
create function public.creator_proposal_choices(p_campaign uuid) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_creator.proposal_choices($1); $$;
revoke all on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_choices(uuid),public.creator_proposal_choices(uuid) to authenticated;

create function adme_creator.proposal_allowed(p_campaign uuid,p_creator text,p_brand uuid,p_owner uuid,p_kind text) returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce(exists(select 1 from public.campaigns ca join public.creators cr on cr.id=p_creator
    where ca.id=p_campaign and ca.owner_id=p_brand and cr.owner_id=p_owner
      and cr.published and cr.moderation_status='allowed' and ca.moderation_status='allowed'
      and ((p_kind='proposal' and p_brand=auth.uid() and public.my_role()='brand')
        or (p_kind='application' and p_owner=auth.uid() and public.my_role()='creator' and ca.status='published'))),false);
$$;
revoke all on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.proposal_allowed(uuid,text,uuid,uuid,text) to authenticated;
drop policy proposals_insert on public.proposals;
create policy proposals_insert on public.proposals for insert to authenticated with check(
  status='pending' and adme_creator.proposal_allowed(campaign_id,creator_id,brand_id,creator_user_id,kind)
);

create function adme_creator.create_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; cr public.creators; result uuid;
begin
  if auth.uid() is null or not ((p_kind='proposal' and public.my_role()='brand') or
    (p_kind='application' and public.my_role()='creator')) then raise exception 'role not allowed' using errcode='42501'; end if;
  if p_campaign is null or p_creator is null or length(p_creator) not between 1 and 100
    or p_brief is null or length(btrim(p_brief)) not between 10 and 3000 then
    raise exception 'invalid proposal fields' using errcode='22023'; end if;
  -- Fixed lock order; moderation/ownership changes cannot interleave after validation.
  select * into ca from public.campaigns where id=p_campaign for share;
  select * into cr from public.creators where id=p_creator for share;
  if ca.id is null or cr.id is null or cr.owner_id is null or not cr.published
    or cr.moderation_status<>'allowed' or ca.moderation_status<>'allowed' then
    raise exception 'collaboration unavailable' using errcode='23514'; end if;
  if not adme_creator.proposal_allowed(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind) then
    raise exception 'proposal not allowed' using errcode='42501'; end if;
  insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,kind,brief)
    values(ca.id,cr.id,ca.owner_id,cr.owner_id,p_kind,btrim(p_brief)) returning id into result;
  return result;
end;
$$;
create function public.create_creator_proposal(p_campaign uuid,p_creator text,p_kind text,p_brief text) returns uuid
language sql security invoker set search_path='' as $$ select adme_creator.create_proposal($1,$2,$3,$4); $$;
revoke all on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.create_proposal(uuid,text,text,text),public.create_creator_proposal(uuid,text,text,text) to authenticated;

create function adme_creator.hot_catalog() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security definer set search_path='' as $$
  select c.id,adme_creator.catalog_dto(c),max(e.expires_at) from public.creators c
  join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
  where c.published and c.moderation_status='allowed' and adme_creator.catalog_dto(c) is not null
    and e.sku='creator_hot' and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
  group by c.id,c.profile,c.published,c.moderation_status,c.owner_id,c.created_at order by max(e.expires_at) desc,c.id collate "C" limit 6;
$$;
create or replace function public.active_hot_creators() returns table(creator_id text,profile jsonb,expires_at timestamptz)
language sql stable security invoker set search_path='' as $$ select * from adme_creator.hot_catalog(); $$;
revoke all on function adme_creator.hot_catalog(),public.active_hot_creators() from public,anon,authenticated,service_role;
grant execute on function adme_creator.hot_catalog(),public.active_hot_creators() to anon,authenticated;

-- Apply only after compatibility RPCs exist. Own settings and approved classic
-- administration retain raw access; public views must use the allowlisted RPC.
drop policy creators_read on public.creators;
create policy creators_read on public.creators for select to authenticated using(owner_id=auth.uid() or public.is_admin());
revoke select on public.creators from anon;
commit;
