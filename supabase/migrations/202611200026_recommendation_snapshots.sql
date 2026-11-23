-- D045: bounded compatibility snapshots for the existing adme-1.0 model.
begin;
create schema adme_recommendation;
revoke all on schema adme_recommendation from public,anon,authenticated,service_role;
grant usage on schema adme_recommendation to authenticated;
create table adme_recommendation.snapshots (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null references public.campaigns(id),
 owner_id uuid not null references public.profiles(id),
 request_key uuid not null,
 model_version text not null check(model_version='adme-1.0'),
 source_contract text not null check(source_contract='public-catalog-v1'),
 source_version text not null,
 input jsonb not null check(jsonb_typeof(input)='object'),
 catalog_count int not null check(catalog_count between 0 and 1000),
 eligible_count int not null check(eligible_count between 0 and catalog_count),
 results jsonb not null check(jsonb_typeof(results)='array' and jsonb_array_length(results)<=6),
 created_at timestamptz not null default statement_timestamp(),
 unique(owner_id,request_key)
);
create index recommendation_history on adme_recommendation.snapshots(campaign_id,created_at desc,id desc);
alter table adme_recommendation.snapshots enable row level security;
revoke all on all tables in schema adme_recommendation from public,anon,authenticated,service_role;
create function adme_recommendation.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'recommendation snapshot is immutable' using errcode='23514'; end;
$$;
create trigger recommendation_immutable before update or delete on adme_recommendation.snapshots for each row execute function adme_recommendation.immutable();

-- No HOT, payment, contact, owner ID or raw profile fields enter this projection.
create function adme_recommendation.project(p jsonb) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',p->'seed_id','name',p->'name','published',p->'published','available',p->'is_available',
 'platforms',p->'platforms','vibes',p->'vibes','categories',p->'categories','formats',p->'formats',
 'price',p->'price_min_krw','isDemo',p->'is_demo','sourceType',p->'data_source','sourceUrl',p->'source_url');
$$;
create function adme_recommendation.context(p_campaign uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ca public.campaigns; input_value jsonb; candidates jsonb;
begin
 select * into ca from public.campaigns where id=p_campaign;
 if auth.uid() is null or ca.id is null or ca.owner_id<>auth.uid() or public.my_role() is distinct from 'brand' or ca.moderation_status<>'allowed' then
 raise exception 'campaign owner required' using errcode='42501'; end if;
 input_value:=jsonb_build_object('category',ca.brief->'category','vibes',ca.brief->'vibes','format',ca.brief->'format',
 'budget_krw',ca.brief->'budget_krw','platforms',ca.brief->'platforms');
 select coalesce(jsonb_agg(adme_recommendation.project(dto) order by id collate "C"),'[]'::jsonb) into candidates
 from (select cr.id,adme_creator.catalog_dto(cr) dto from public.creators cr
 where adme_creator.catalog_dto(cr) is not null order by cr.id collate "C" limit 1001) c;
 if jsonb_array_length(candidates)>1000 then raise exception 'catalog exceeds reviewed snapshot cap' using errcode='54000'; end if;
 return jsonb_build_object('input',input_value,'candidates',candidates,'sourceVersion',md5(jsonb_build_array(input_value,candidates)::text));
end;
$$;
-- Frozen v1 adapter; parity tested against catalog.match. D044 owns future models.
create function adme_recommendation.score_v1(b jsonb,c jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare overlap jsonb; tone numeric; category numeric; budget numeric; format_value numeric; coverage int; total numeric; breakdown jsonb; missing jsonb; eligible boolean;
begin
 select coalesce(jsonb_agg(t.value order by t.ordinality),'[]'::jsonb) into overlap from jsonb_array_elements(b->'vibes') with ordinality t(value,ordinality) where (c->'vibes') @> jsonb_build_array(t.value);
 tone:=case when jsonb_array_length(b->'vibes')>0 then jsonb_array_length(overlap)::numeric/jsonb_array_length(b->'vibes') end;
 category:=case when coalesce(b->>'category','')<>'' then case when (c->'categories') @> jsonb_build_array(b->>'category') then 1 else 0 end end;
 budget:=case when (b->>'budget_krw')::numeric>0 then case when (c->>'price')::numeric=0 then 1 else least(1,(b->>'budget_krw')::numeric/(c->>'price')::numeric) end end;
 format_value:=case when coalesce(b->>'format','')<>'' then case when (c->'formats') @> jsonb_build_array(b->>'format') then 1 else 0 end end;
 coverage:=(case when tone is not null then 28 else 0 end)+(case when category is not null then 25 else 0 end)+(case when budget is not null then 15 else 0 end)+(case when format_value is not null then 12 else 0 end);
 total:=case when coverage>0 then round((coalesce(tone,0)*28+coalesce(category,0)*25+coalesce(budget,0)*15+coalesce(format_value,0)*12)/coverage*100) end;
 eligible:=c->'published'='true'::jsonb and c->'available'='true'::jsonb and
 (coalesce(jsonb_array_length(b->'platforms'),0)=0 or exists(select 1 from jsonb_array_elements(b->'platforms') p where c->'platforms' @> jsonb_build_array(p.value)));
 breakdown:=jsonb_build_array(
 jsonb_build_object('factor','이미지·분위기','weight',28,'value',tone,'evidence',case when jsonb_array_length(overlap)>0 then (select string_agg(v,', ' order by n) from jsonb_array_elements_text(overlap) with ordinality a(v,n)) else '일치 태그 없음' end),
 jsonb_build_object('factor','콘텐츠 분야','weight',25,'value',category,'evidence',(select coalesce(string_agg(v,', ' order by n),'') from jsonb_array_elements_text(c->'categories') with ordinality a(v,n))),
 jsonb_build_object('factor','타깃 고객','weight',20,'value',null,'evidence','오디언스 데이터 미확보'),
 jsonb_build_object('factor','예산','weight',15,'value',budget,'evidence','최소 견적 '||(c->>'price')||'원 ('||case when c->'isDemo'='true'::jsonb then '가상' else '본인 등록' end||')'),
 jsonb_build_object('factor','광고 형식','weight',12,'value',format_value,'evidence',(select coalesce(string_agg(v,', ' order by n),'') from jsonb_array_elements_text(c->'formats') with ordinality a(v,n))));
 select jsonb_agg(v->'factor') into missing from jsonb_array_elements(breakdown) v where v->'value'='null'::jsonb;
 return jsonb_build_object('creatorId',c->'id','name',c->'name','isDemo',c->'isDemo','sourceType',c->'sourceType','sourceUrl',c->'sourceUrl',
 'sourceVersion',md5(c::text),'input',c-'name'-'sourceType'-'sourceUrl','eligible',eligible,'score',total,'coverage',coverage,'matchedTags',overlap,'missing',coalesce(missing,'[]'::jsonb),'breakdown',breakdown);
end;
$$;
create function adme_recommendation.create_snapshot(p_campaign uuid,p_key uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare context_value jsonb; prior adme_recommendation.snapshots; snapshot_id uuid; ranked jsonb; n int;
begin
 if p_key is null or p_campaign is null then raise invalid_parameter_value; end if;
 -- Serialize per campaign, including concurrent same-key retries.
 perform 1 from public.campaigns where id=p_campaign for share;
 if auth.uid() is null or not exists(select 1 from public.campaigns where id=p_campaign and owner_id=auth.uid() and moderation_status='allowed') or public.my_role() is distinct from 'brand' then
 raise exception 'campaign owner required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into prior from adme_recommendation.snapshots where owner_id=auth.uid() and request_key=p_key;
 if found then
 if prior.campaign_id<>p_campaign then raise exception 'request key conflict' using errcode='23505'; end if;
 return prior.id; end if;
 context_value:=adme_recommendation.context(p_campaign);
 perform adme_ops.require_quota('recommendation_create',auth.uid()::text,10,3600);
 with scores as (select adme_recommendation.score_v1(context_value->'input',c) r from jsonb_array_elements(context_value->'candidates') c),
 eligible as(select r,row_number() over(order by (r->>'score')::numeric desc nulls last,r->>'creatorId' collate "C") position from scores where r->'eligible'='true'::jsonb)
 select coalesce(jsonb_agg(r||jsonb_build_object('position',position) order by position) filter(where position<=6),'[]'::jsonb),count(*)::int into ranked,n from eligible;
 insert into adme_recommendation.snapshots(campaign_id,owner_id,request_key,model_version,source_contract,source_version,input,catalog_count,eligible_count,results)
 values(p_campaign,auth.uid(),p_key,'adme-1.0','public-catalog-v1',context_value->>'sourceVersion',context_value->'input',jsonb_array_length(context_value->'candidates'),n,ranked) returning id into snapshot_id;
 return snapshot_id;
end;
$$;
create function adme_recommendation.page(p_campaign uuid,p_snapshot uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare context_value jsonb; s adme_recommendation.snapshots; history jsonb; visible jsonb;
begin
 context_value:=adme_recommendation.context(p_campaign);
 perform adme_ops.require_quota('recommendation_read',auth.uid()::text,120,60);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'createdAt',created_at) order by created_at desc,id desc),'[]'::jsonb) into history
 from(select id,created_at from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 20) h;
 if p_snapshot is null then select * into s from adme_recommendation.snapshots where campaign_id=p_campaign and owner_id=auth.uid() order by created_at desc,id desc limit 1;
 else select * into s from adme_recommendation.snapshots where id=p_snapshot and campaign_id=p_campaign and owner_id=auth.uid();
 if not found then raise exception 'snapshot unavailable' using errcode='42501'; end if; end if;
 if s.id is null then return jsonb_build_object('version',1,'campaignId',p_campaign,'snapshot',null,'history',history); end if;
 -- Re-check consent/visibility on every read, including archived snapshots.
 select coalesce(jsonb_agg(r||jsonb_build_object('sourceUrl',case when r->'sourceUrl'=c->'sourceUrl' then r->'sourceUrl' else 'null'::jsonb end) order by (r->>'position')::int),'[]'::jsonb) into visible
 from jsonb_array_elements(s.results) r join jsonb_array_elements(context_value->'candidates') c on c->>'id'=r->>'creatorId';
 return jsonb_build_object('version',1,'campaignId',p_campaign,'history',history,'snapshot',jsonb_build_object(
 'id',s.id,'createdAt',s.created_at,'modelVersion',s.model_version,'sourceContract',s.source_contract,'sourceVersion',s.source_version,
 'stale',s.source_version<>(context_value->>'sourceVersion'),'input',s.input,'catalogCount',s.catalog_count,'eligibleCount',s.eligible_count,
 'withheldCount',jsonb_array_length(s.results)-jsonb_array_length(visible),'results',visible));
end;
$$;
create function public.recommendation_create(p_campaign uuid,p_key uuid) returns uuid language sql security invoker set search_path='' as $$ select adme_recommendation.create_snapshot($1,$2); $$;
create function public.recommendation_page(p_campaign uuid,p_snapshot uuid default null) returns jsonb language sql security invoker set search_path='' as $$ select adme_recommendation.page($1,$2); $$;
revoke all on all functions in schema adme_recommendation from public,anon,authenticated,service_role;
grant execute on function adme_recommendation.create_snapshot(uuid,uuid),adme_recommendation.page(uuid,uuid) to authenticated;
revoke all on function public.recommendation_create(uuid,uuid),public.recommendation_page(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.recommendation_create(uuid,uuid),public.recommendation_page(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
