-- D045: additive adme-1.2 snapshots. Frozen 1.0 history and readers survive.
begin;
alter table adme_recommendation.snapshots drop constraint snapshots_model_version_check;
alter table adme_recommendation.snapshots add constraint snapshots_model_version_check check(model_version in ('adme-1.0','adme-1.2'));
alter table adme_recommendation.snapshots add column held_count int not null default 0
 check(held_count>=0 and held_count+eligible_count<=catalog_count);

create function adme_recommendation.normalize_policy(p jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 p:=coalesce(nullif(p,'null'::jsonb),'{}'::jsonb);
 if jsonb_typeof(p)<>'object' then raise invalid_parameter_value; end if;
 if exists(select 1 from jsonb_each(p) e where e.key not in ('category','budget','unknown')
   or jsonb_typeof(e.value)<>'string'
   or (e.key in ('category','budget') and e.value#>>'{}' not in ('hard','soft'))
   or (e.key='unknown' and e.value#>>'{}' not in ('hold','exclude'))) then raise invalid_parameter_value; end if;
 return jsonb_build_object('category',coalesce(p->>'category','soft'),'budget',coalesce(p->>'budget','soft'),'unknown',coalesce(p->>'unknown','hold'));
end;$$;

create function adme_recommendation.context_v12(p_campaign uuid,p_demo boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare ca public.campaigns; input_value jsonb; candidates jsonb; item jsonb;
begin
 perform adme_privacy.enforce_actor();
 select * into ca from public.campaigns where id=p_campaign;
 if auth.uid() is null or ca.id is null or ca.owner_id<>auth.uid() or public.my_role() is distinct from 'brand' or ca.moderation_status<>'allowed' then raise insufficient_privilege; end if;
 perform adme_ops.require_quota('recommendation_context',auth.uid()::text,120,60);
 if jsonb_typeof(ca.brief->'budget_krw') is distinct from 'number' then raise invalid_parameter_value; end if;
 if (ca.brief->>'budget_krw')::numeric not between 0 and 100000000 or trunc((ca.brief->>'budget_krw')::numeric)<>(ca.brief->>'budget_krw')::numeric then raise invalid_parameter_value; end if;
 foreach item in array array[ca.brief->'vibes',ca.brief->'platforms'] loop
  if jsonb_typeof(item) is distinct from 'array' then raise invalid_parameter_value; end if;
  if jsonb_array_length(item)>8 or exists(select 1 from jsonb_array_elements(item) v where jsonb_typeof(v)<>'string' or length(v#>>'{}')>50) then raise invalid_parameter_value; end if;
 end loop;
 if jsonb_typeof(ca.brief->'category') is distinct from 'string' or length(ca.brief->>'category')>50
 or jsonb_typeof(ca.brief->'format') is distinct from 'string' or length(ca.brief->>'format')>50 then raise invalid_parameter_value; end if;
 input_value:=jsonb_build_object('category',ca.brief->'category','vibes',ca.brief->'vibes','format',ca.brief->'format',
 'budget_krw',ca.brief->'budget_krw','platforms',ca.brief->'platforms','policy',adme_recommendation.normalize_policy(ca.brief->'policy'),'includeDemo',coalesce(p_demo,false));
 select coalesce(jsonb_agg(adme_recommendation.project(dto) order by id collate "C"),'[]'::jsonb) into candidates
 from (select cr.id,adme_creator.catalog_dto(cr) dto from public.creators cr
 where (coalesce(p_demo,false) or cr.profile->'is_demo'='false'::jsonb) and adme_creator.catalog_dto(cr) is not null order by cr.id collate "C" limit 1001) c;
 if jsonb_array_length(candidates)>1000 then raise exception 'catalog exceeds reviewed snapshot cap' using errcode='54000'; end if;
 return jsonb_build_object('input',input_value,'candidates',candidates,'sourceVersion',md5(jsonb_build_array('adme-1.2',input_value,candidates)::text));
end;$$;

create function adme_recommendation.score_v12(b jsonb,c jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare policy jsonb:=adme_recommendation.normalize_policy(b->'policy'); excluded jsonb:='[]'; held jsonb:='[]'; status text;
 requested jsonb; overlap jsonb; quote numeric; amount numeric; tone numeric; category numeric; budget numeric; format_value numeric;
 coverage int; total numeric; breakdown jsonb; missing jsonb; result jsonb;
begin
 if jsonb_typeof(b->'budget_krw') is distinct from 'number' then raise invalid_parameter_value; end if;
 amount:=(b->>'budget_krw')::numeric;
 if amount not between 0 and 100000000 or trunc(amount)<>amount then raise invalid_parameter_value; end if;
 if jsonb_typeof(c->'price')='number' then
  quote:=(c->>'price')::numeric;
  if quote not between 0 and 100000000 or trunc(quote)<>quote then quote:=null; end if;
 end if;
 c:=jsonb_set(c,'{price}',coalesce(to_jsonb(quote),'null'::jsonb));
 if c->'published' is distinct from 'true'::jsonb then excluded:=excluded||jsonb_build_array('비공개 프로필'); end if;
 if c->'available' is distinct from 'true'::jsonb then excluded:=excluded||jsonb_build_array(case when c->'available'='false'::jsonb then '협업 불가 일정' else '협업 의사 미확인' end); end if;
 if jsonb_array_length(b->'platforms')>0 and not exists(select 1 from jsonb_array_elements(b->'platforms') p where c->'platforms' @> jsonb_build_array(p.value)) then excluded:=excluded||jsonb_build_array('플랫폼 불일치'); end if;
 if policy->>'category'='hard' and b->>'category'<>'' then
  if jsonb_array_length(c->'categories')=0 then
   if policy->>'unknown'='exclude' then excluded:=excluded||jsonb_build_array('분야 미확인'); else held:=held||jsonb_build_array('분야 미확인'); end if;
  elsif not (c->'categories' @> jsonb_build_array(b->>'category')) then excluded:=excluded||jsonb_build_array('분야 불일치(필수)'); end if;
 end if;
 if policy->>'budget'='hard' and amount>0 then
  if quote is null then
   if policy->>'unknown'='exclude' then excluded:=excluded||jsonb_build_array('견적 미확인'); else held:=held||jsonb_build_array('견적 미확인'); end if;
  elsif quote>amount then excluded:=excluded||jsonb_build_array('예산 초과(필수)'); end if;
 end if;
 status:=case when jsonb_array_length(excluded)>0 then 'excluded' when jsonb_array_length(held)>0 then 'hold' else 'eligible' end;
 result:=jsonb_build_object('creatorId',c->'id','name',c->'name','isDemo',c->'isDemo','sourceType',c->'sourceType','sourceUrl',c->'sourceUrl',
 'sourceVersion',md5(c::text),'input',c-'name'-'sourceType'-'sourceUrl','eligible',status='eligible','status',status,'reasons',excluded||held,'policy',policy,'version','adme-1.2');
 if status='excluded' then return result||jsonb_build_object('score',null,'coverage',0,'breakdown','[]'::jsonb,'matchedTags','[]'::jsonb,'missing','[]'::jsonb); end if;
 select coalesce(jsonb_agg(value order by n),'[]'::jsonb) into requested from (select value,min(ordinality) n from jsonb_array_elements(b->'vibes') with ordinality group by value) d;
 select coalesce(jsonb_agg(t.value order by t.ordinality),'[]'::jsonb) into overlap from jsonb_array_elements(requested) with ordinality t(value,ordinality) where c->'vibes' @> jsonb_build_array(t.value);
 tone:=case when jsonb_array_length(requested)>0 and jsonb_array_length(c->'vibes')>0 then jsonb_array_length(overlap)::numeric/jsonb_array_length(requested) end;
 category:=case when b->>'category'<>'' and jsonb_array_length(c->'categories')>0 then case when c->'categories' @> jsonb_build_array(b->>'category') then 1 else 0 end end;
 budget:=case when amount>0 and quote is not null then case when quote=0 then 1 else least(1,amount/quote) end end;
 format_value:=case when b->>'format'<>'' and jsonb_array_length(c->'formats')>0 then case when c->'formats' @> jsonb_build_array(b->>'format') then 1 else 0 end end;
 coverage:=(case when tone is not null then 28 else 0 end)+(case when category is not null then 25 else 0 end)+(case when budget is not null then 15 else 0 end)+(case when format_value is not null then 12 else 0 end);
 total:=case when coverage>0 then round((coalesce(tone,0)*28+coalesce(category,0)*25+coalesce(budget,0)*15+coalesce(format_value,0)*12)/coverage*100) else 0 end;
 breakdown:=jsonb_build_array(
 jsonb_build_object('factor','이미지·분위기','weight',28,'value',tone,'evidence',case when jsonb_array_length(c->'vibes')=0 then '분위기 정보 미확인' else (select coalesce(string_agg(v,', ' order by n),'일치 태그 없음') from jsonb_array_elements_text(overlap) with ordinality a(v,n)) end),
 jsonb_build_object('factor','콘텐츠 분야','weight',25,'value',category,'evidence',(select coalesce(string_agg(v,', ' order by n),'분야 미확인') from jsonb_array_elements_text(c->'categories') with ordinality a(v,n))),
 jsonb_build_object('factor','타깃 고객','weight',20,'value',null,'evidence','오디언스 데이터 미확보'),
 jsonb_build_object('factor','예산','weight',15,'value',budget,'evidence',case when quote is null then '견적 미확인' else '최소 견적 '||to_char(quote,'FM999,999,999')||'원 ('||case when c->'isDemo'='true'::jsonb then '가상' else '본인 등록' end||')' end),
 jsonb_build_object('factor','광고 형식','weight',12,'value',format_value,'evidence',(select coalesce(string_agg(v,', ' order by n),'광고 형식 미확인') from jsonb_array_elements_text(c->'formats') with ordinality a(v,n))));
 select jsonb_agg(v->'factor') into missing from jsonb_array_elements(breakdown) v where v->'value'='null'::jsonb;
 return result||jsonb_build_object('score',total,'coverage',coverage,'matchedTags',overlap,'missing',coalesce(missing,'[]'::jsonb),'breakdown',breakdown);
end;$$;

create function adme_recommendation.create_snapshot_v12(p_campaign uuid,p_key uuid,p_demo boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare context_value jsonb; prior adme_recommendation.snapshots; snapshot_id uuid; ranked jsonb; n int; h int;
begin
 if p_key is null or p_campaign is null then raise invalid_parameter_value; end if;
 perform adme_privacy.enforce_actor();
 perform 1 from public.campaigns where id=p_campaign for share;
 if auth.uid() is null or not exists(select 1 from public.campaigns where id=p_campaign and owner_id=auth.uid() and moderation_status='allowed') or public.my_role() is distinct from 'brand' then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_key::text,0));
 select * into prior from adme_recommendation.snapshots where owner_id=auth.uid() and request_key=p_key;
 if found then
  if prior.campaign_id<>p_campaign then raise exception 'request key conflict' using errcode='23505'; end if;
  return prior.id;
 end if;
 context_value:=adme_recommendation.context_v12(p_campaign,p_demo);
 perform adme_ops.require_quota('recommendation_create',auth.uid()::text,10,3600);
 with scores as materialized (select adme_recommendation.score_v12(context_value->'input',c) r from jsonb_array_elements(context_value->'candidates') c),
 candidates as(select r,row_number() over(order by (r->>'status'='hold'),(r->>'score')::numeric desc,r->>'creatorId' collate "C") position from scores where r->>'status'<>'excluded')
 select coalesce(jsonb_agg(r||jsonb_build_object('position',position) order by position) filter(where position<=6),'[]'::jsonb),count(*) filter(where r->>'status'='eligible')::int,count(*) filter(where r->>'status'='hold')::int into ranked,n,h from candidates;
 insert into adme_recommendation.snapshots(campaign_id,owner_id,request_key,model_version,source_contract,source_version,input,catalog_count,eligible_count,held_count,results)
 values(p_campaign,auth.uid(),p_key,'adme-1.2','public-catalog-v1',context_value->>'sourceVersion',context_value->'input',jsonb_array_length(context_value->'candidates'),n,h,ranked) returning id into snapshot_id;
 return snapshot_id;
end;$$;

-- Preserve reviewed current visibility/reference logic while separating old readers.
do $patch$
declare d text; changed text;
begin
 d:=pg_get_functiondef('adme_recommendation.page(uuid,uuid)'::regprocedure);
 changed:=replace(d,'adme_recommendation.page(p_campaign uuid, p_snapshot uuid)','adme_recommendation.page_v12(p_campaign uuid, p_snapshot uuid, p_demo boolean)');
 changed:=replace(changed,'adme_recommendation.context(p_campaign)','adme_recommendation.context_v12(p_campaign,p_demo)');
 changed:=replace(changed,'''eligibleCount'',s.eligible_count,','''eligibleCount'',s.eligible_count,''heldCount'',s.held_count,');
 if changed=d or position('page_v12(' in changed)=0 or position('''heldCount''' in changed)=0 then raise exception 'unexpected recommendation page baseline'; end if;
 execute changed;
 changed:=replace(d,'owner_id=auth.uid()','owner_id=auth.uid() and model_version=''adme-1.0''');
 if changed=d then raise exception 'unexpected recommendation history baseline'; end if;
 execute changed;
 d:=pg_get_functiondef('adme_recommendation.context_unmetered(uuid)'::regprocedure);
 changed:=replace(d,'''sourceVersion'',md5(jsonb_build_array(input_value,candidates)::text)','''policy'',adme_recommendation.normalize_policy(ca.brief->''policy''),''sourceVersion'',md5(jsonb_build_array(input_value,candidates,adme_recommendation.normalize_policy(ca.brief->''policy''))::text)');
 if changed=d then raise exception 'unexpected recommendation context baseline'; end if;
 execute changed;
 d:=pg_get_functiondef('adme_recommendation.create_snapshot(uuid,uuid)'::regprocedure);
 changed:=replace(d,'context_value:=adme_recommendation.context(p_campaign);',
 'context_value:=adme_recommendation.context(p_campaign); if context_value#>>''{policy,category}''=''hard'' or context_value#>>''{policy,budget}''=''hard'' then raise invalid_parameter_value; end if;');
 changed:=replace(changed,'return prior.id; end if;','if prior.model_version<>''adme-1.0'' then raise unique_violation; end if; return prior.id; end if;');
 if changed=d then raise exception 'unexpected recommendation create baseline'; end if;
 execute changed;
end;$patch$;
create function public.recommendation_create_v12(p_campaign uuid,p_key uuid,p_demo boolean default false) returns uuid language sql security invoker set search_path='' as $$ select adme_recommendation.create_snapshot_v12($1,$2,$3); $$;
create function public.recommendation_page_v12(p_campaign uuid,p_snapshot uuid default null,p_demo boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select adme_recommendation.page_v12($1,$2,$3); $$;
revoke all on function adme_recommendation.normalize_policy(jsonb),adme_recommendation.context_v12(uuid,boolean),adme_recommendation.score_v12(jsonb,jsonb),adme_recommendation.create_snapshot_v12(uuid,uuid,boolean),adme_recommendation.page_v12(uuid,uuid,boolean),public.recommendation_create_v12(uuid,uuid,boolean),public.recommendation_page_v12(uuid,uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function adme_recommendation.create_snapshot_v12(uuid,uuid,boolean),adme_recommendation.page_v12(uuid,uuid,boolean),public.recommendation_create_v12(uuid,uuid,boolean),public.recommendation_page_v12(uuid,uuid,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
