begin;
set local lock_timeout='5s';
set local statement_timeout='120s';
-- Exact reviewed 105 baseline versions/names and critical function definitions. Unknown/partial/old41 STOP.
do $preflight$ begin
 if to_regclass('supabase_migrations.schema_migrations') is null
 or to_regclass('public.saved_list_items') is null or to_regclass('public.saved_creators') is not null then
  raise exception 'STOP: reviewed 105 baseline missing; request an inspected application packet';end if;
 if (select count(*)from supabase_migrations.schema_migrations)<>105 or exists(
  select 1 from(values ('202611190001','core'),
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
('20261123110001','youtube_public_boundary'))expected(version,name)left join supabase_migrations.schema_migrations m using(version)
  where m.version is null or m.name is distinct from expected.name
 )then raise exception 'STOP: history/source mismatch, partial or unknown baseline; do not force SQL';end if;
 if exists(select 1 from(values ('adme_ops.featured_youtube(text,text,integer)','e6198814dee70d7a2a3f0ba6561eca0ea26ca7195367fd8b10f79c69ee7bd3e0'),
('adme_creator.saved_catalog()','717e744cb840486a836ecc24ff8bf4f6764c1813c67ac288993c3c2c6f7c9712'),
('adme_creator.toggle_saved(text)','8e6469455214a7f4e41d6fe345c0e6a92bb33e078678b66fdf1ad7ba3f9c7e26'),
('public.ensure_default_list()','0201182c61e09e92f7dd02f9657794d57bf035778e15f1f236f8f98965085e25'),
('public.serve_promotion_slots(boolean)','2551a16c00170e89e8a0f89603cb775427db63bf7fea4ceb0d404e6f05124702'),
('adme_ops.channel_fresh(text)','d318419bbd81cfe929108bd08214364557e9d2c2af63f282864e248889ffeb9c'),
('adme_creator.catalog_dto(public.creators)','cdfee7a38e71a1954e20e6d04602b4d399dd4bc27b2814515c659a78884759fc'))expected(signature,hash)
 where to_regprocedure(expected.signature)is null or encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(expected.signature)),'UTF8')),'hex')is distinct from expected.hash)
 then raise exception 'STOP: reviewed baseline function definition mismatch';end if;
end $preflight$;

-- 20261123112401 youtube_directory_pagination SHA256 ac8327b004ccc7ece78128df2755a49ceed2247e5df7e47faeda04b6d777a73c
-- D033: public YouTube filtering before bounded keyset pagination. No provider/network work.
create index youtube_directory_subscribers106 on adme_ops.channels(subscriber_count desc nulls last,title collate "C",channel_id)where review<>'rejected';
create index youtube_directory_updated106 on adme_ops.channels(fetched_at desc,title collate "C",channel_id)where review<>'rejected';
create function adme_ops.youtube_directory_page(p_filters jsonb,p_cursor text,p_limit integer)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare f jsonb:=p_filters;signature text;cursor_value jsonb;cursor_k numeric;cursor_name text;cursor_id text;sort_value text;topic_values text[];pattern text;result jsonb;
begin
 if f is null or jsonb_typeof(f)<>'object'or(select count(*)from jsonb_object_keys(f))<>4 or exists(select 1 from jsonb_object_keys(f)k where k not in('query','topic','subscribers','sort'))or exists(select 1 from jsonb_each(f)e where jsonb_typeof(e.value)<>'string')then raise invalid_parameter_value;end if;
 if length(f->>'query')>80 or f->>'subscribers'not in('','under-100k','100k-1m','over-1m')or f->>'sort'not in('subscribers','updated','name')or f->>'topic'not in('','뷰티·패션','음식','테크·게임','건강·운동','라이프스타일','엔터테인먼트')or p_limit is null or p_limit not between 1 and 50 then raise invalid_parameter_value;end if;
 signature:=md5(jsonb_build_array('youtube-directory-v1',f)::text);sort_value:=f->>'sort';
 topic_values:=case f->>'topic'when '뷰티·패션'then array['Fashion']when '음식'then array['Food']when '테크·게임'then array['Technology','Video_game']when '건강·운동'then array['Physical_fitness','Health','Sport']when '라이프스타일'then array['Lifestyle_(sociology)','Hobby','Tourism']when '엔터테인먼트'then array['Entertainment','Film','Music']else array[]::text[]end;
 pattern:='%'||replace(replace(replace(btrim(f->>'query'),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 if p_cursor is not null then
 if length(p_cursor)>1500 then raise invalid_parameter_value;end if;
 begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;exception when others then raise invalid_parameter_value;end;
 if jsonb_typeof(cursor_value)<>'object'or cursor_value->>'h'is distinct from signature or cursor_value->>'v'is distinct from '1'or cursor_value->>'i'is null or cursor_value->>'i'!~'^UC[A-Za-z0-9_-]{22}$'or cursor_value->>'n'is null or length(cursor_value->>'n')not between 1 and 100 or cursor_value->>'k'is null or cursor_value->>'k'!~'^-?[0-9]{1,22}$'then raise invalid_parameter_value;end if;
 cursor_k:=(cursor_value->>'k')::numeric;cursor_name:=cursor_value->>'n';cursor_id:=cursor_value->>'i';
 end if;
 perform adme_ops.require_quota('youtube_directory',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 60 end,60);
 with visible as materialized(
 select ch.channel_id,ch.title,case when ch.subscriber_count between 0 and 9007199254740991 then ch.subscriber_count else null end subscriber_count,ch.fetched_at,owner.creator_id,'[]'::jsonb videos,jsonb_build_object('avatar',ch.metadata->'avatar','topics',ch.metadata->'topics')metadata
 from adme_ops.channels ch left join lateral(
 select adme_creator.public_reference(c.id)creator_id from adme_ops.channel_claims claim join public.creators c on c.owner_id=claim.owner_id
 where claim.channel_id=ch.channel_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and c.published and coalesce(c.profile->>'is_demo','false')='false'and adme_creator.catalog_dto(c)is not null order by c.id limit 1
 )owner on true
 where ch.review<>'rejected'and adme_ops.channel_fresh(ch.channel_id)and(owner.creator_id is not null or exists(select 1 from adme_ops.featured_channel_ids fi where fi.channel_id=ch.channel_id))
 and ch.title ilike pattern escape E'\\'
 and(cardinality(topic_values)=0 or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(ch.metadata->'topics')='array'then ch.metadata->'topics'else'[]'::jsonb end)t where regexp_replace(t,'^.*/','')=any(topic_values)))
 ),filtered as materialized(
 select v.*,case when sort_value='updated'then -(extract(epoch from fetched_at)*1000000)::numeric when sort_value='subscribers'then coalesce(-subscriber_count::numeric,10000000000000000000)else 0 end k from visible v
 where f->>'subscribers'=''or(f->>'subscribers'='under-100k'and subscriber_count<100000)or(f->>'subscribers'='100k-1m'and subscriber_count>=100000 and subscriber_count<1000000)or(f->>'subscribers'='over-1m'and subscriber_count>=1000000)
 ),page as(
 select *,row_number()over(order by k,title collate "C",channel_id collate "C")rn from filtered
 where p_cursor is null or(k,title collate "C",channel_id collate "C")>(cursor_k,cursor_name collate "C",cursor_id collate "C")order by k,title collate "C",channel_id collate "C"limit p_limit+1
 )select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(to_jsonb(p)-'k'-'rn'order by rn)from page p where rn<=p_limit),'[]'::jsonb),'total',(select count(*)from filtered),'nextCursor',case when exists(select 1 from page where rn>p_limit)then(select replace(encode(convert_to(jsonb_build_object('v',1,'h',signature,'i',channel_id,'n',title,'k',k)::text,'UTF8'),'base64'),chr(10),'')from page where rn=p_limit)else null end)into result;
 return result;
end;$$;
create function public.youtube_directory_page(p_filters jsonb,p_cursor text default null,p_limit integer default 24)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_ops.youtube_directory_page($1,$2,$3);$$;
revoke all on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)from public,anon,authenticated,service_role;
grant execute on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123112401','youtube_directory_pagination',array[$adme_sequential_source$-- D033: public YouTube filtering before bounded keyset pagination. No provider/network work.
begin;
create index youtube_directory_subscribers106 on adme_ops.channels(subscriber_count desc nulls last,title collate "C",channel_id)where review<>'rejected';
create index youtube_directory_updated106 on adme_ops.channels(fetched_at desc,title collate "C",channel_id)where review<>'rejected';
create function adme_ops.youtube_directory_page(p_filters jsonb,p_cursor text,p_limit integer)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare f jsonb:=p_filters;signature text;cursor_value jsonb;cursor_k numeric;cursor_name text;cursor_id text;sort_value text;topic_values text[];pattern text;result jsonb;
begin
 if f is null or jsonb_typeof(f)<>'object'or(select count(*)from jsonb_object_keys(f))<>4 or exists(select 1 from jsonb_object_keys(f)k where k not in('query','topic','subscribers','sort'))or exists(select 1 from jsonb_each(f)e where jsonb_typeof(e.value)<>'string')then raise invalid_parameter_value;end if;
 if length(f->>'query')>80 or f->>'subscribers'not in('','under-100k','100k-1m','over-1m')or f->>'sort'not in('subscribers','updated','name')or f->>'topic'not in('','뷰티·패션','음식','테크·게임','건강·운동','라이프스타일','엔터테인먼트')or p_limit is null or p_limit not between 1 and 50 then raise invalid_parameter_value;end if;
 signature:=md5(jsonb_build_array('youtube-directory-v1',f)::text);sort_value:=f->>'sort';
 topic_values:=case f->>'topic'when '뷰티·패션'then array['Fashion']when '음식'then array['Food']when '테크·게임'then array['Technology','Video_game']when '건강·운동'then array['Physical_fitness','Health','Sport']when '라이프스타일'then array['Lifestyle_(sociology)','Hobby','Tourism']when '엔터테인먼트'then array['Entertainment','Film','Music']else array[]::text[]end;
 pattern:='%'||replace(replace(replace(btrim(f->>'query'),E'\\',E'\\\\'),'%',E'\\%'),'_',E'\\_')||'%';
 if p_cursor is not null then
 if length(p_cursor)>1500 then raise invalid_parameter_value;end if;
 begin cursor_value:=convert_from(decode(p_cursor,'base64'),'UTF8')::jsonb;exception when others then raise invalid_parameter_value;end;
 if jsonb_typeof(cursor_value)<>'object'or cursor_value->>'h'is distinct from signature or cursor_value->>'v'is distinct from '1'or cursor_value->>'i'is null or cursor_value->>'i'!~'^UC[A-Za-z0-9_-]{22}$'or cursor_value->>'n'is null or length(cursor_value->>'n')not between 1 and 100 or cursor_value->>'k'is null or cursor_value->>'k'!~'^-?[0-9]{1,22}$'then raise invalid_parameter_value;end if;
 cursor_k:=(cursor_value->>'k')::numeric;cursor_name:=cursor_value->>'n';cursor_id:=cursor_value->>'i';
 end if;
 perform adme_ops.require_quota('youtube_directory',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 60 end,60);
 with visible as materialized(
 select ch.channel_id,ch.title,case when ch.subscriber_count between 0 and 9007199254740991 then ch.subscriber_count else null end subscriber_count,ch.fetched_at,owner.creator_id,'[]'::jsonb videos,jsonb_build_object('avatar',ch.metadata->'avatar','topics',ch.metadata->'topics')metadata
 from adme_ops.channels ch left join lateral(
 select adme_creator.public_reference(c.id)creator_id from adme_ops.channel_claims claim join public.creators c on c.owner_id=claim.owner_id
 where claim.channel_id=ch.channel_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and c.published and coalesce(c.profile->>'is_demo','false')='false'and adme_creator.catalog_dto(c)is not null order by c.id limit 1
 )owner on true
 where ch.review<>'rejected'and adme_ops.channel_fresh(ch.channel_id)and(owner.creator_id is not null or exists(select 1 from adme_ops.featured_channel_ids fi where fi.channel_id=ch.channel_id))
 and ch.title ilike pattern escape E'\\'
 and(cardinality(topic_values)=0 or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(ch.metadata->'topics')='array'then ch.metadata->'topics'else'[]'::jsonb end)t where regexp_replace(t,'^.*/','')=any(topic_values)))
 ),filtered as materialized(
 select v.*,case when sort_value='updated'then -(extract(epoch from fetched_at)*1000000)::numeric when sort_value='subscribers'then coalesce(-subscriber_count::numeric,10000000000000000000)else 0 end k from visible v
 where f->>'subscribers'=''or(f->>'subscribers'='under-100k'and subscriber_count<100000)or(f->>'subscribers'='100k-1m'and subscriber_count>=100000 and subscriber_count<1000000)or(f->>'subscribers'='over-1m'and subscriber_count>=1000000)
 ),page as(
 select *,row_number()over(order by k,title collate "C",channel_id collate "C")rn from filtered
 where p_cursor is null or(k,title collate "C",channel_id collate "C")>(cursor_k,cursor_name collate "C",cursor_id collate "C")order by k,title collate "C",channel_id collate "C"limit p_limit+1
 )select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(to_jsonb(p)-'k'-'rn'order by rn)from page p where rn<=p_limit),'[]'::jsonb),'total',(select count(*)from filtered),'nextCursor',case when exists(select 1 from page where rn>p_limit)then(select replace(encode(convert_to(jsonb_build_object('v',1,'h',signature,'i',channel_id,'n',title,'k',k)::text,'UTF8'),'base64'),chr(10),'')from page where rn=p_limit)else null end)into result;
 return result;
end;$$;
create function public.youtube_directory_page(p_filters jsonb,p_cursor text default null,p_limit integer default 24)returns jsonb language sql volatile security invoker set search_path=''as $$select adme_ops.youtube_directory_page($1,$2,$3);$$;
revoke all on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)from public,anon,authenticated,service_role;
grant execute on function adme_ops.youtube_directory_page(jsonb,text,integer),public.youtube_directory_page(jsonb,text,integer)to anon,authenticated;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);

-- 20261123113123 youtube_directory_cursor_integer SHA256 6d03a94c183573583611db22085e9cb72f9f5356f00f97d895c27b2d3c4f18ad
-- D033 forward fix: epoch numeric scale must not produce fractional JSON cursors.
do $$declare definition text;previous text := $fragment$-(extract(epoch from fetched_at)*1000000)::numeric$fragment$;
begin
 definition:=pg_get_functiondef('adme_ops.youtube_directory_page(jsonb,text,integer)'::regprocedure);
 if strpos(definition,previous)=0 then raise exception 'Expected directory timestamp sort is missing';end if;
 execute replace(definition,previous,'-((extract(epoch from fetched_at)*1000000)::bigint)::numeric');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123113123','youtube_directory_cursor_integer',array[$adme_sequential_source$-- D033 forward fix: epoch numeric scale must not produce fractional JSON cursors.
begin;
do $$declare definition text;previous text := $fragment$-(extract(epoch from fetched_at)*1000000)::numeric$fragment$;
begin
 definition:=pg_get_functiondef('adme_ops.youtube_directory_page(jsonb,text,integer)'::regprocedure);
 if strpos(definition,previous)=0 then raise exception 'Expected directory timestamp sort is missing';end if;
 execute replace(definition,previous,'-((extract(epoch from fetched_at)*1000000)::bigint)::numeric');
end;$$;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);

-- 20261123114341 saved_catalog_list_compatibility SHA256 533969f74d45584cc460969f6875e508671f383197f50556e54e30cb6a8aba79
-- D075: preserve safe public-reference gateways after main retires saved_creators.
create or replace function adme_creator.saved_catalog()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c))order by c.id collate "C")
 from public.saved_list_items s join public.saved_lists l on l.id=s.list_id and l.owner_id=s.owner_id join public.creators c on c.id=s.creator_id
 where s.owner_id=auth.uid()and l.is_default),'[]'::jsonb);
end;$$;
create or replace function adme_creator.toggle_saved(p_ref text)returns boolean language plpgsql security definer set search_path=''as $$
declare id_value text;existed boolean;list_value uuid;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);if id_value is null then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 select id into list_value from public.saved_lists where owner_id=auth.uid()and is_default;
 if list_value is not null then
  delete from public.saved_list_items where list_id=list_value and owner_id=auth.uid()and creator_id=id_value returning true into existed;
  if coalesce(existed,false)then return false;end if;
 end if;
 if not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 list_value:=public.ensure_default_list();if list_value is null then raise check_violation using message='default list unavailable';end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(list_value,auth.uid(),id_value);return true;
end;$$;
revoke all on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123114341','saved_catalog_list_compatibility',array[$adme_sequential_source$-- D075: preserve safe public-reference gateways after main retires saved_creators.
begin;
create or replace function adme_creator.saved_catalog()returns jsonb language plpgsql stable security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(jsonb_build_object('creator_id',adme_creator.public_reference(c.id),'creator',adme_creator.catalog_dto(c))order by c.id collate "C")
 from public.saved_list_items s join public.saved_lists l on l.id=s.list_id and l.owner_id=s.owner_id join public.creators c on c.id=s.creator_id
 where s.owner_id=auth.uid()and l.is_default),'[]'::jsonb);
end;$$;
create or replace function adme_creator.toggle_saved(p_ref text)returns boolean language plpgsql security definer set search_path=''as $$
declare id_value text;existed boolean;list_value uuid;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_ref is null or length(p_ref)not between 1 and 100 then raise invalid_parameter_value;end if;
 id_value:=adme_creator.resolve_reference(p_ref);if id_value is null then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_toggle',auth.uid()::text,60,60);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||id_value,0));
 select id into list_value from public.saved_lists where owner_id=auth.uid()and is_default;
 if list_value is not null then
  delete from public.saved_list_items where list_id=list_value and owner_id=auth.uid()and creator_id=id_value returning true into existed;
  if coalesce(existed,false)then return false;end if;
 end if;
 if not exists(select 1 from public.creators c where c.id=id_value and adme_creator.catalog_dto(c)is not null)then raise insufficient_privilege;end if;
 list_value:=public.ensure_default_list();if list_value is null then raise check_violation using message='default list unavailable';end if;
 insert into public.saved_list_items(list_id,owner_id,creator_id)values(list_value,auth.uid(),id_value);return true;
end;$$;
revoke all on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)from public,anon,authenticated,service_role;
grant execute on function adme_creator.saved_catalog(),adme_creator.toggle_saved(text)to authenticated;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);

-- 20261123114636 promotion_public_reference_boundary SHA256 fa6d0d076b7da1cd83fc76826ad1929e3807c25dd435192b9a3b5608368cacba
-- D075: retain DEV-B's service-only HOT slots with DEV-A publication/opaque-reference gates.
create or replace function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int,creator_id text,name text,category text,starts_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''as $$
begin
 if not adme_release.billing_enabled()then return;end if;
 return query
 with active as(
  select distinct on(c.id)c.id cid,adme_creator.catalog_dto(c)dto,e.id eid,e.starts_at s,e.expires_at x
  from public.creators c join public.entitlements e on e.owner_id=c.owner_id and e.sku='creator_hot'
  left join public.orders o on o.id=e.order_id
  where c.published and c.claim_status='verified'and adme_creator.catalog_dto(c)is not null and public.entitlement_active(e)and(e.order_id is null or o.status='paid')
  and(coalesce(c.profile->>'is_demo','false')='true'or exists(select 1 from adme_ops.channel_claims claim join adme_ops.channels ch using(channel_id)
   where claim.owner_id=c.owner_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and adme_ops.channel_fresh(ch.channel_id)))
  order by c.id,e.starts_at,e.id
 ),picked as(
  select row_number()over(order by s,cid)::int pos,*from active order by s,cid limit 3
 ),counted as(
  insert into public.promotion_impressions as pi(entitlement_id,n)select eid,1 from picked where coalesce(p_record,false)
  on conflict(day,entitlement_id)do update set n=pi.n+1 returning 1
 )select p.pos,adme_creator.public_reference(p.cid),p.dto->>'name',p.dto->'categories'->>0,p.s,p.x from picked p cross join(select count(*)from counted)q order by p.pos;
end;$$;
revoke all on function public.serve_promotion_slots(boolean)from public,anon,authenticated,service_role;
grant execute on function public.serve_promotion_slots(boolean)to service_role;
-- The retired full-profile client endpoint remains unavailable.
revoke all on function public.active_hot_creators()from public,anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('20261123114636','promotion_public_reference_boundary',array[$adme_sequential_source$-- D075: retain DEV-B's service-only HOT slots with DEV-A publication/opaque-reference gates.
begin;
create or replace function public.serve_promotion_slots(p_record boolean default false)
returns table(slot int,creator_id text,name text,category text,starts_at timestamptz,expires_at timestamptz)
language plpgsql security definer set search_path=''as $$
begin
 if not adme_release.billing_enabled()then return;end if;
 return query
 with active as(
  select distinct on(c.id)c.id cid,adme_creator.catalog_dto(c)dto,e.id eid,e.starts_at s,e.expires_at x
  from public.creators c join public.entitlements e on e.owner_id=c.owner_id and e.sku='creator_hot'
  left join public.orders o on o.id=e.order_id
  where c.published and c.claim_status='verified'and adme_creator.catalog_dto(c)is not null and public.entitlement_active(e)and(e.order_id is null or o.status='paid')
  and(coalesce(c.profile->>'is_demo','false')='true'or exists(select 1 from adme_ops.channel_claims claim join adme_ops.channels ch using(channel_id)
   where claim.owner_id=c.owner_id and claim.verified_at is not null and claim.consent_at is not null and ch.review='accepted'and adme_ops.channel_fresh(ch.channel_id)))
  order by c.id,e.starts_at,e.id
 ),picked as(
  select row_number()over(order by s,cid)::int pos,*from active order by s,cid limit 3
 ),counted as(
  insert into public.promotion_impressions as pi(entitlement_id,n)select eid,1 from picked where coalesce(p_record,false)
  on conflict(day,entitlement_id)do update set n=pi.n+1 returning 1
 )select p.pos,adme_creator.public_reference(p.cid),p.dto->>'name',p.dto->'categories'->>0,p.s,p.x from picked p cross join(select count(*)from counted)q order by p.pos;
end;$$;
revoke all on function public.serve_promotion_slots(boolean)from public,anon,authenticated,service_role;
grant execute on function public.serve_promotion_slots(boolean)to service_role;
-- The retired full-profile client endpoint remains unavailable.
revoke all on function public.active_hot_creators()from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
$adme_sequential_source$]);
notify pgrst,'reload schema';
commit;
