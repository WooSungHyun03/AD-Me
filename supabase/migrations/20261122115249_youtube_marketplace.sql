begin;

insert into public.products(sku,name,amount,role,days,credits) values
 ('search_run','AI 검색권',3000,'brand',30,1),
 ('job_post','광고 공고 게시권',5000,'brand',30,1),
 ('job_application','광고 지원권',1000,'creator',30,1);

create table public.brand_products (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null default auth.uid() references public.profiles(id),
 name text not null check (char_length(btrim(name)) between 2 and 100),
 description text not null check (char_length(btrim(description)) between 5 and 1200),
 created_at timestamptz not null default now()
);
create index brand_products_owner on public.brand_products(owner_id,created_at desc);
alter table public.brand_products enable row level security;
revoke all on public.brand_products from public,anon,authenticated;
grant select,insert on public.brand_products to authenticated;
create policy product_owner_read on public.brand_products for select to authenticated using (owner_id=(select auth.uid()));
create policy product_brand_create on public.brand_products for insert to authenticated
 with check (owner_id=(select auth.uid()) and (select public.my_role())='brand');

create table adme_ops.job_posts (
 campaign_id uuid primary key references public.campaigns(id) on delete cascade,
 product_id uuid not null references public.brand_products(id),
 published_at timestamptz,
 expires_at timestamptz,
 check ((published_at is null and expires_at is null) or (expires_at>published_at))
);
create table adme_ops.credit_uses (
 owner_id uuid not null references public.profiles(id),
 sku text not null references public.products(sku),
 action_key text not null,
 entitlement_id uuid not null references public.entitlements(id),
 result jsonb not null,
 created_at timestamptz not null default now(),
 primary key(owner_id,sku,action_key)
);
alter table adme_ops.job_posts enable row level security;
alter table adme_ops.credit_uses enable row level security;

create function adme_ops.marketplace_locked(p_campaign uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from adme_ops.job_posts where campaign_id=p_campaign)
$$;
revoke all on function adme_ops.marketplace_locked(uuid) from public,anon,authenticated;
grant execute on function adme_ops.marketplace_locked(uuid) to authenticated;

create function adme_ops.marketplace_visible(p_campaign uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select not exists(select 1 from adme_ops.job_posts j where j.campaign_id=p_campaign
   and (j.expires_at is null or j.expires_at<=now()))
$$;
revoke all on function adme_ops.marketplace_visible(uuid) from public,anon,authenticated;
grant execute on function adme_ops.marketplace_visible(uuid) to anon,authenticated;
alter policy campaigns_read on public.campaigns
 using ((status='published' and adme_ops.marketplace_visible(id)) or owner_id=auth.uid() or public.is_admin());

alter policy campaigns_update on public.campaigns
 using (owner_id=auth.uid() and public.my_role()='brand' and not adme_ops.marketplace_locked(id))
 with check (owner_id=auth.uid() and not is_demo and seed_id is null and not adme_ops.marketplace_locked(id));
alter policy campaigns_delete on public.campaigns
 using (owner_id=auth.uid() and not adme_ops.marketplace_locked(id));
alter policy proposals_insert on public.proposals
 with check (status='pending' and not (kind='application' and adme_ops.marketplace_locked(campaign_id))
 and exists(select 1 from public.campaigns ca join public.creators cr on cr.id=creator_id
 where ca.id=campaign_id and ca.owner_id=brand_id and cr.owner_id=creator_user_id and cr.published
 and ((kind='proposal' and brand_id=auth.uid() and public.my_role()='brand')
 or (kind='application' and creator_user_id=auth.uid() and public.my_role()='creator' and ca.status='published'))));

create function adme_ops.marketplace_credit(p_owner uuid,p_sku text,p_action text,p_result jsonb)
returns void language plpgsql set search_path='' as $$
declare pass uuid;
begin
 select e.id into pass from public.entitlements e join public.orders o on o.id=e.order_id
 where e.owner_id=p_owner and e.sku=p_sku and e.credits>0 and e.starts_at<=now() and e.expires_at>now()
   and o.status='paid' and o.owner_id=p_owner and o.sku=p_sku
 order by e.expires_at,e.id limit 1 for update of e;
 if not found then raise exception 'MARKETPLACE_CREDIT_REQUIRED' using errcode='P0001'; end if;
 update public.entitlements set credits=credits-1 where id=pass;
 insert into adme_ops.credit_uses(owner_id,sku,action_key,entitlement_id,result)
 values(p_owner,p_sku,p_action,pass,p_result);
end;
$$;
revoke all on function adme_ops.marketplace_credit(uuid,text,text,jsonb) from public,anon,authenticated;

create function adme_ops.marketplace_create(p_product uuid,p_brief jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); campaign uuid; product text;
begin
 if actor is null or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 select name into product from public.brand_products where id=p_product and owner_id=actor;
 if not found then raise insufficient_privilege; end if;
 p_brief := (select jsonb_object_agg(key,value) from jsonb_each(p_brief)
 where key in ('title','category','vibes','format','budget_krw','target_audience','goal')) || jsonb_build_object('platforms',jsonb_build_array('youtube'),'product',product,'status','draft');
 if p_brief is null or not public.valid_campaign_dto(p_brief) or octet_length(p_brief::text)>7000 then raise invalid_parameter_value; end if;
 insert into public.campaigns(owner_id,brief,status) values(actor,p_brief,'draft') returning id into campaign;
 insert into adme_ops.job_posts(campaign_id,product_id) values(campaign,p_product);
 return campaign;
end;
$$;

create function adme_ops.marketplace_action(p_action text,p_campaign uuid,p_pitch text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); job record; response jsonb; proposal uuid; creator text;
begin
 if actor is null then raise insufficient_privilege; end if;
 select c.owner_id,c.status,j.published_at,j.expires_at into job from adme_ops.job_posts j
 join public.campaigns c on c.id=j.campaign_id where j.campaign_id=p_campaign for update of c,j;
 if not found then raise no_data_found; end if;
 if p_action in ('publish','close') then
   if job.owner_id<>actor or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
   if p_action='close' then
     update public.campaigns set status='closed' where id=p_campaign;
     return jsonb_build_object('id',p_campaign,'status','closed');
   end if;
   if job.published_at is not null and job.status='published' and job.expires_at>now() then
     return jsonb_build_object('id',p_campaign,'status','published');
   end if;
   if job.status<>'draft' then raise invalid_parameter_value; end if;
   response := jsonb_build_object('id',p_campaign,'status','published');
   perform adme_ops.marketplace_credit(actor,'job_post',p_campaign::text,response);
   update adme_ops.job_posts set published_at=now(),expires_at=now()+interval '30 days' where campaign_id=p_campaign;
   update public.campaigns set status='published' where id=p_campaign;
   return response;
 end if;
 if p_action is distinct from 'apply' then raise invalid_parameter_value; end if;
 if public.my_role() is distinct from 'creator' or job.owner_id=actor then raise insufficient_privilege; end if;
 select l.result into response from adme_ops.credit_uses l
 where l.owner_id=actor and l.sku='job_application' and l.action_key=p_campaign::text;
 if found then return response; end if;
 if job.status<>'published' or job.expires_at<=now() or job.expires_at is null then raise invalid_parameter_value; end if;
 select c.id into creator from public.creators c where c.owner_id=actor and c.published
 and c.profile->>'is_available'='true' and c.profile->'platforms' ? 'youtube'
 and exists(select 1 from adme_ops.channel_claims cl where cl.owner_id=actor and cl.verified_at is not null)
 for share;
 if not found then raise insufficient_privilege; end if;
 if p_pitch is null or char_length(btrim(p_pitch)) not between 10 and 2000 then raise invalid_parameter_value; end if;
 insert into public.proposals(campaign_id,creator_id,brand_id,creator_user_id,brief,kind)
 values(p_campaign,creator,job.owner_id,actor,btrim(p_pitch),'application') returning id into proposal;
 response := jsonb_build_object('id',proposal,'status','submitted');
 perform adme_ops.marketplace_credit(actor,'job_application',p_campaign::text,response);
 return response;
end;
$$;

create function adme_ops.marketplace_board(p_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(result)), '[]') from (
 select c.id,c.brief,case when c.status='published' and j.expires_at<=now() then 'closed' else c.status end as status,j.expires_at,coalesce(c.owner_id=auth.uid(),false) as owned,
   exists(select 1 from public.proposals p where p.campaign_id=c.id
     and p.creator_user_id=auth.uid() and p.kind='application') as applied
 from adme_ops.job_posts j join public.campaigns c on c.id=j.campaign_id
 where (p_id is null or c.id=p_id) and
   (c.owner_id=auth.uid() or (c.status='published' and j.expires_at>now()))
 order by c.created_at desc,c.id limit 60
 ) result
$$;

create function public.marketplace_create(p_product uuid,p_brief jsonb) returns uuid
language sql security invoker set search_path='' as $$ select adme_ops.marketplace_create($1,$2); $$;
create function public.marketplace_action(p_action text,p_campaign uuid,p_pitch text default '') returns jsonb
language sql security invoker set search_path='' as $$ select adme_ops.marketplace_action($1,$2,$3); $$;
create function public.marketplace_board(p_id uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$ select adme_ops.marketplace_board($1); $$;

revoke all on function public.marketplace_create(uuid,jsonb), adme_ops.marketplace_create(uuid,jsonb),
 public.marketplace_action(text,uuid,text), adme_ops.marketplace_action(text,uuid,text),
 public.marketplace_board(uuid), adme_ops.marketplace_board(uuid) from public,anon,authenticated;
grant execute on function public.marketplace_create(uuid,jsonb), adme_ops.marketplace_create(uuid,jsonb),
 public.marketplace_action(text,uuid,text), adme_ops.marketplace_action(text,uuid,text) to authenticated;
grant execute on function public.marketplace_board(uuid), adme_ops.marketplace_board(uuid) to anon,authenticated;
create function adme_ops.marketplace_search(p_query text,p_min bigint,p_max bigint,p_days integer,p_budget integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); terms text; key text; results jsonb;
begin
 if actor is null or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 terms := lower(regexp_replace(btrim(coalesce(p_query,'')), '\s+', ' ', 'g'));
 if char_length(terms)>120 or p_min not between 0 and 10000000000
   or p_max not between p_min and 10000000000 or p_days not in (0,30,90)
   or p_budget not between 0 and 100000000
   or p_min is null or p_max is null or p_days is null or p_budget is null then raise invalid_parameter_value; end if;
 key := jsonb_build_array(terms,p_min,p_max,p_days,p_budget)::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':search:'||key, 0));
 select result into results from adme_ops.credit_uses where owner_id=actor and sku='search_run' and action_key=key;
 -- Reapply current visibility when reopening; never restore a withdrawn channel from a saved result.
 if found then
   return (select coalesce(jsonb_agg(item.value order by item.ordinality),'[]') from jsonb_array_elements(results) with ordinality item
     where exists(select 1 from adme_ops.channel_claims cl
       join adme_ops.channels ch using(channel_id) join public.creators cr on cr.owner_id=cl.owner_id
       where cr.id=item.value->>'id' and cr.published and cl.consent_at is not null and cl.verified_at is not null
         and ch.review='accepted' and ch.fetched_at>now()-interval '30 days'));
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',candidate.id,'reason',candidate.reason) order by candidate.score desc,candidate.id),'[]') into results from (
  select cr.id,
   case when terms<>'' and strpos(lower(concat_ws(' ',cr.profile->>'categories',cr.profile->>'vibes',cr.profile->>'formats')),terms)>0
        then 1 else 0 end score,
   case when terms<>'' and strpos(lower(concat_ws(' ',cr.profile->>'categories',cr.profile->>'vibes',cr.profile->>'formats')),terms)>0
     then '크리에이터가 등록한 분야·태그·제작 형식과 검색어가 일치합니다.'
     else '공개 검증 채널과 선택한 조건에 일치합니다.' end reason
  from public.creators cr
  where cr.published and cr.profile->>'is_demo'='false' and cr.profile->>'is_available'='true'
    and cr.profile->'platforms' ? 'youtube'
    and (p_budget=0 or (cr.profile->>'price_min_krw')::integer<=p_budget)
    and exists(select 1 from adme_ops.channels ch join adme_ops.channel_claims cl using(channel_id)
      where cl.owner_id=cr.owner_id and cl.verified_at is not null and cl.consent_at is not null
        and ch.review='accepted' and ch.fetched_at>now()-interval '30 days'
        and ((p_min=0 and p_max=10000000000) or ch.subscriber_count between p_min and p_max)
        and (p_days=0 or exists(select 1 from jsonb_array_elements(ch.videos) v
          where (v->>'publishedAt')::timestamptz>=now()-make_interval(days=>p_days))))
    and (terms='' or strpos(lower(concat_ws(' ',cr.profile->>'categories',cr.profile->>'vibes',cr.profile->>'formats')),terms)>0)
  order by score desc,cr.id limit 25
 ) candidate;
 if results<>'[]'::jsonb then perform adme_ops.marketplace_credit(actor,'search_run',key,results); end if;
 return results;
end;
$$;
create function public.marketplace_search(p_query text,p_min bigint,p_max bigint,p_days integer,p_budget integer)
returns jsonb language sql security invoker set search_path='' as $$
 select adme_ops.marketplace_search($1,$2,$3,$4,$5);
$$;
revoke all on function public.marketplace_search(text,bigint,bigint,integer,integer),
 adme_ops.marketplace_search(text,bigint,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.marketplace_search(text,bigint,bigint,integer,integer),
 adme_ops.marketplace_search(text,bigint,bigint,integer,integer) to authenticated;

-- Keep legacy order identifiers callable and serialize new marketplace checkout attempts per account.
create or replace function public.create_test_order(p_sku text) returns public.orders
language plpgsql security definer set search_path='' as $$
declare item public.products; result public.orders; actor uuid := auth.uid();
begin
 select * into item from public.products where sku=p_sku;
 if not found or actor is null or public.my_role() is distinct from item.role then raise insufficient_privilege; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||':checkout',0));
 if p_sku in ('job_application','creator_hot') and not exists(
  select 1 from adme_ops.channel_claims where owner_id=actor and verified_at is not null
 ) then raise insufficient_privilege; end if;
 if p_sku in ('search_run','job_post','job_application','creator_hot') then
  select * into result from public.orders where owner_id=actor and sku=p_sku and status='pending'
  and created_at>now()-interval '8 minutes' order by created_at desc limit 1;
  if found then return result; end if;
 end if;
 if (select count(*) from public.orders where owner_id=actor and created_at>now()-interval '1 hour')>=20 then
  raise program_limit_exceeded;
 end if;
 insert into public.orders(owner_id,sku,amount) values(actor,item.sku,item.amount) returning * into result;
 return result;
end;
$$;

create or replace function public.active_hot_creators()
returns table(creator_id text,profile jsonb,expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select c.id,c.profile,max(e.expires_at) from public.creators c
 join public.entitlements e on e.owner_id=c.owner_id join public.orders o on o.id=e.order_id
 where c.published and c.profile->>'is_demo'='false' and c.profile->'platforms' ? 'youtube'
   and e.sku='creator_hot' and e.starts_at<=now() and e.expires_at>now() and o.status='paid'
   and exists(select 1 from adme_ops.channel_claims cl join adme_ops.channels ch using(channel_id)
     where cl.owner_id=c.owner_id and cl.verified_at is not null and cl.consent_at is not null
       and ch.review='accepted' and ch.fetched_at>now()-interval '30 days')
 group by c.id,c.profile order by max(e.expires_at),c.id limit 2
$$;
commit;
