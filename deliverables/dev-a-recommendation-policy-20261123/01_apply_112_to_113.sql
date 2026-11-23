begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Reviewed112 versions/names and7 exact critical function definitions; no applied-history rewrite.
do $preflight$ begin
 if to_regprocedure('public.recommendation_create_v12(uuid,uuid,boolean)')is not null then raise exception 'STOP: v12 already exists; inspect partial/repeated application';end if;
 if(select count(*)from supabase_migrations.schema_migrations)<>112 or exists(select 1 from(values ('202611190001','core'),
('202611190002','operations'),
('202611190003','json_contracts'),
('202611190004','admin_security'),
('202611190005','moderation_locks'),
('202611190006','brand_profiles'),
('202611190007','brand_projection'),
('202611200001','intelligence'),
('202611200002','intelligence_cron'),
('202611200003','intelligence_settings_safe_update'),
('202611200004','youtube_ownership'),
('202611200005','private_operations_functions'),
('202611200006','ops_mfa'),
('202611200007','rate_limits'),
('202611200008','youtube_moderation'),
('202611200010','message_policy'),
('202611200011','draft_read_limits'),
('202611200012','campaign_terms'),
('202611200013','creator_identity'),
('202611200014','creator_read_boundary'),
('202611200015','creator_catalog_quota'),
('202611200016','creator_boundary_activation'),
('202611200017','proposal_visibility'),
('202611200018','conversations'),
('202611200019','review_workflow'),
('202611200020','review_public_boundary'),
('202611200021','ad_history'),
('202611200022','review_withdraw_quota'),
('202611200023','ad_evidence_gate'),
('202611200024','latest_response_consent'),
('202611200025','deliverable_versions'),
('202611200026','recommendation_snapshots'),
('202611200027','recommendation_campaign_delete'),
('202611200028','recommendation_read_budget'),
('202611210035','home_catalog'),
('202611210036','test_billing_boundary'),
('202611210037','filtered_catalog'),
('202611210038','auth_request_budget'),
('202611210039','private_images'),
('202611210040','brand_logo_projection'),
('202611210041','public_creator_references'),
('202611210042','normalized_public_read'),
('202611210043','image_transport_limit'),
('202611210044','service_budget_usage'),
('202611210045','reference_precedence'),
('202611210046','filter_reference_epoch'),
('202611210047','consent_versions'),
('202611210048','sensitive_boundaries'),
('202611210049','ingestion_recovery'),
('202611210050','source_budget_public_refs'),
('202611210051','brand_public_text'),
('202611210052','checkpoint_quota_reservation'),
('202611210053','withdraw_channel_consent'),
('202611210054','consent_rollout_boundary'),
('202611210055','publication_transactions'),
('202611210056','publication_guard_record'),
('202611210057','global_withdrawal_receipts'),
('202611210058','deletion_quarantine'),
('202611210059','deletion_private_helpers'),
('202611210060','deletion_owned_jobs'),
('202611220061','ad_timeline'),
('202611220062','metric_history'),
('202611220063','ad_cursor_reference'),
('202611220064','metric_filters'),
('202611220065','admin_support'),
('202611220066','metric_metadata_guard'),
('202611220067','history_permission'),
('202611220068','saved_searches'),
('20261122115249','youtube_marketplace'),
('20261122115930','marketplace_chat'),
('20261122224757','featured_youtube_directory'),
('20261122231018','youtube_profile_details'),
('20261122231403','youtube_profile_contact'),
('20261122231628','youtube_profile_claim_sync'),
('202611230075','main_integration_guards'),
('202611230076','worker_integration'),
('202611230077','worker_budget_compatibility'),
('20261123055918','youtube_directory_topic_projection'),
('20261123100004','claims'),
('20261123100005','profile_fields'),
('20261123100006','creator_search'),
('20261123100007','campaign_recruiting'),
('20261123100008','saved_lists'),
('20261123100009','proposal_events'),
('20261123100010','notifications'),
('20261123100011','report_queue'),
('20261123100012','privacy_exports'),
('20261123100013','private_uploads'),
('20261123100014','safety_blocks'),
('20261123100015','retention_tombstones'),
('20261123100016','ops_stats'),
('20261123100017','product_events'),
('20261123100018','preferences_consent'),
('20261123100019','notes_compare'),
('20261123100020','matching_feedback'),
('20261123100021','ai_usage'),
('20261123100022','email_outbox_delivery'),
('20261123100023','selection_review'),
('20261123100024','ops_metrics_inquiries'),
('20261123100025','usage_ledger'),
('20261123100026','promotion_slots'),
('20261123100027','test_cancellation'),
('20261123100028','reconcile_marketplace'),
('20261123100029','archived_report_appeal'),
('20261123110001','youtube_public_boundary'),
('20261123112401','youtube_directory_pagination'),
('20261123113123','youtube_directory_cursor_integer'),
('20261123114341','saved_catalog_list_compatibility'),
('20261123114636','promotion_public_reference_boundary'),
('20261123121526','campaign_brief_file_versions'),
('20261123122650','brief_upload_attestation_snapshot'),
('20261123123531','brief_account_budget'))e(version,name)left join supabase_migrations.schema_migrations m using(version)where m.version is null or m.name is distinct from e.name)then raise exception 'STOP: unsupported or partial baseline';end if;
 if exists(select 1 from(values ('adme_privacy.enforce_actor()','11a0656634b8b0d39b0ddee7a94630f58c19f84ac5ca24a154734c5446ea7de4'),
('adme_recommendation.context_unmetered(uuid)','9655a654e2eac4ba40cb9916b3cb5b9f0b65b26dfc90e7b6d6d1f288bb5e9f87'),
('adme_recommendation.context(uuid)','47a5868e03a2b2057e1a99cea3ff80b27f60beb543479e76bcd0505f6c1fb5bb'),
('adme_recommendation.page(uuid,uuid)','8a90bdac0c93e14eab34005dd0d7c308159ccf3f10a13d1bdc26a5668560cfc8'),
('adme_recommendation.create_snapshot(uuid,uuid)','1b009f5f24df7e1bcca655c5c057062769baf7a567a72491ae03732f0c68304f'),
('adme_recommendation.score_v1(jsonb,jsonb)','ababb53c8b537b91098847695a1168efef0f6799dfc7f80a728c17f447506cf3'),
('adme_creator.catalog_dto(public.creators)','cdfee7a38e71a1954e20e6d04602b4d399dd4bc27b2814515c659a78884759fc'))e(signature,hash)where to_regprocedure(e.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(e.signature)),'UTF8')),'hex')is distinct from e.hash)then raise exception 'STOP: baseline visibility/scoring/access contract mismatch';end if;
end $preflight$;
-- D045: additive adme-1.2 snapshots. Frozen 1.0 history and readers survive.
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

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123125600','policy_aware_recommendation_snapshots',array[$adme_policy_source$-- D045: additive adme-1.2 snapshots. Frozen 1.0 history and readers survive.
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
$adme_policy_source$]);
commit;
