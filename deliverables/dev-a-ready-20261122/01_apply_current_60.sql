begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-ready-p1-20261122'));
-- Reviewed exact60 baseline; custom functions/history/hooks require developer review.
do $$begin
 if(select count(*)from supabase_migrations.schema_migrations)<>60 or exists(select 1 from supabase_migrations.schema_migrations where version not in('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024','202611200025','202611200026','202611200027','202611200028','202611210035','202611210036','202611210037','202611210038','202611210039','202611210040','202611210041','202611210042','202611210043','202611210044','202611210045','202611210046','202611210047','202611210048','202611210049','202611210050','202611210051','202611210052','202611210053','202611210054','202611210055','202611210056','202611210057','202611210058','202611210059','202611210060'))then raise exception 'STOP: expected reviewed60 baseline';end if;
 if to_regclass('adme_review.competitors')is not null or to_regclass('adme_ops.support_audit')is not null then raise exception 'STOP: new tables already exist';end if;
 if md5(replace(pg_get_functiondef('adme_creator.normalized_public(text)'::regprocedure),E'\r\n',E'\n'))<>'f6ba6a24d1e83dccc2de56df0777165d' or md5(replace(pg_get_functiondef('adme_creator.filtered_page(jsonb,text,int,boolean)'::regprocedure),E'\r\n',E'\n'))<>'a9cd3a1679f52c54d865cdb86c53bd8e' or md5(replace(pg_get_functiondef('public.moderate_entity(text,text,boolean,text)'::regprocedure),E'\r\n',E'\n'))<>'9e9063fa5473631b216394246fce9617' then raise exception 'STOP: reviewed baseline functions required';end if;
 if not exists(select 1 from pg_db_role_setting s join pg_roles r on r.oid=s.setrole cross join lateral unnest(s.setconfig)cfg(value)where r.rolname='authenticator'and cfg.value='pgrst.db_pre_request=adme_privacy.enforce_actor')or exists(select 1 from pg_db_role_setting s cross join lateral unnest(s.setconfig)cfg(value)where cfg.value like 'pgrst.db_pre_request=%'and cfg.value<>'pgrst.db_pre_request=adme_privacy.enforce_actor')then raise exception 'STOP: preserve and review DataAPI hook';end if;
end$$;

-- SOURCE 202611220061_ad_timeline.sql
-- D030: latest reviewed advertisements; rivals are private per brand account.
create table adme_review.competitors(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 label text not null check(length(btrim(label)) between 2 and 100 and label=btrim(label)),
 primary key(owner_id,label)
);
alter table adme_review.competitors enable row level security;
revoke all on adme_review.competitors from public,anon,authenticated,service_role;
create function adme_review.my_competitors() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role()<>'brand' then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(label order by label) from adme_review.competitors where owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create function public.my_ad_competitors() returns jsonb language sql security invoker set search_path='' as $$select adme_review.my_competitors();$$;
create function adme_review.set_competitors(p_labels jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role()<>'brand' then raise insufficient_privilege;end if;
 if jsonb_typeof(p_labels) is distinct from 'array' or jsonb_array_length(p_labels)>20 then raise invalid_parameter_value;end if;
 if exists(select 1 from jsonb_array_elements(p_labels)v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 2 and 100 or (v#>>'{}')~'[[:cntrl:]]')then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-rivals:'||auth.uid()::text,0));
 perform adme_ops.require_quota('ad_rivals',auth.uid()::text,30,3600);
 delete from adme_review.competitors where owner_id=auth.uid();
 insert into adme_review.competitors select auth.uid(),min(btrim(v#>>'{}')) from jsonb_array_elements(p_labels)v group by lower(btrim(v#>>'{}'));
 return adme_review.my_competitors();
end;$$;
create function public.set_ad_competitors(p_labels jsonb) returns jsonb language sql security invoker set search_path='' as $$select adme_review.set_competitors($1);$$;
create function adme_review.ad_page(p_creator text,p_brand text,p_category text,p_from date,p_to date,p_after jsonb,p_limit int) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; fingerprint jsonb;
begin
 if p_creator is null or length(p_creator) not between 1 and 100 or p_brand is null or length(p_brand)>100 or p_category is null or length(p_category)>50 or p_limit is null or p_limit not between 1 and 50 or p_from>p_to then raise invalid_parameter_value;end if;
 fingerprint:=jsonb_build_object('creator',p_creator,'brand',p_brand,'category',p_category,'from',p_from,'to',p_to);
 if p_after is not null and (jsonb_typeof(p_after) is distinct from 'object' or p_after->'filter' is distinct from fingerprint or not(p_after?'date' and p_after?'id') or (select count(*)from jsonb_object_keys(p_after))<>3)then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('ad_timeline',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 120 end,60);
 with visible as materialized(
 select c.id,r.payload,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind','ad','isDemo',c.is_demo,'payload',adme_review.public_payload('ad',r.payload),'classification','ad_evidence','summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
 'response',(select case when s.publish_consent then jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at)else null end from adme_review.responses s where s.case_id=c.id and s.version<=c.version order by s.created_at desc,s.id desc limit 1)) dto
 from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version join adme_review.decisions d on d.case_id=c.id and d.version=c.version join public.creators cr on cr.id=c.creator_id cross join adme_review.policy p
 where c.creator_id=adme_creator.resolve_reference(p_creator) and c.kind='ad' and c.status='approved' and c.public_visible and d.publish and d.classification='ad_evidence' and p.ad_enabled and d.policy_version=p.ad_version and adme_creator.catalog_dto(cr)is not null
 and r.payload->>'evidenceKind' in('paid_partnership_label','official_confirmation')and r.payload->>'interest'<>'unknown'
 and(p_brand=''or position(lower(p_brand)in lower(r.payload->>'brandLabel'))>0)and(p_category=''or r.payload->>'category'=p_category)
 and(p_from is null or(r.payload->>'endedOn')::date>=p_from)and(p_to is null or(r.payload->>'startedOn')::date<=p_to)
 ), page as(select *,row_number()over(order by payload->>'startedOn' desc,id desc)n from visible where p_after is null or ((payload->>'startedOn')::date,id)<((p_after->>'date')::date,(p_after->>'id')::uuid) order by payload->>'startedOn' desc,id desc limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(jsonb_build_object('record',dto,'competitor',auth.uid()is not null and public.my_role()='brand' and exists(select 1 from adme_review.competitors v where v.owner_id=auth.uid()and lower(v.label)=lower(page.payload->>'brandLabel')))order by n)from page where n<=p_limit),'[]'::jsonb),'total',(select count(*)from visible),'nextCursor',(select jsonb_build_object('filter',fingerprint,'date',payload->>'startedOn','id',id)from page where n=p_limit and exists(select 1 from page where n>p_limit)))into result;
 return result;
end;$$;
create function public.ad_history_page(p_creator text,p_brand text default '',p_category text default '',p_from date default null,p_to date default null,p_after jsonb default null,p_limit int default 20)returns jsonb language sql security invoker set search_path='' as $$select adme_review.ad_page($1,$2,$3,$4,$5,$6,$7);$$;
revoke all on function adme_review.my_competitors(),public.my_ad_competitors(),adme_review.set_competitors(jsonb),public.set_ad_competitors(jsonb),adme_review.ad_page(text,text,text,date,date,jsonb,int),public.ad_history_page(text,text,text,date,date,jsonb,int)from public,anon,authenticated,service_role;
grant execute on function adme_review.my_competitors(),public.my_ad_competitors(),adme_review.set_competitors(jsonb),public.set_ad_competitors(jsonb)to authenticated;
grant execute on function adme_review.ad_page(text,text,text,date,date,jsonb,int),public.ad_history_page(text,text,text,date,date,jsonb,int)to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220061','ad_timeline',array[$ready_source$-- D030: latest reviewed advertisements; rivals are private per brand account.
begin;
create table adme_review.competitors(
 owner_id uuid not null references public.profiles(id) on delete cascade,
 label text not null check(length(btrim(label)) between 2 and 100 and label=btrim(label)),
 primary key(owner_id,label)
);
alter table adme_review.competitors enable row level security;
revoke all on adme_review.competitors from public,anon,authenticated,service_role;
create function adme_review.my_competitors() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role()<>'brand' then raise insufficient_privilege;end if;
 return coalesce((select jsonb_agg(label order by label) from adme_review.competitors where owner_id=auth.uid()),'[]'::jsonb);
end;$$;
create function public.my_ad_competitors() returns jsonb language sql security invoker set search_path='' as $$select adme_review.my_competitors();$$;
create function adme_review.set_competitors(p_labels jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or public.my_role()<>'brand' then raise insufficient_privilege;end if;
 if jsonb_typeof(p_labels) is distinct from 'array' or jsonb_array_length(p_labels)>20 then raise invalid_parameter_value;end if;
 if exists(select 1 from jsonb_array_elements(p_labels)v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}')) not between 2 and 100 or (v#>>'{}')~'[[:cntrl:]]')then raise invalid_parameter_value;end if;
 perform pg_advisory_xact_lock(hashtextextended('ad-rivals:'||auth.uid()::text,0));
 perform adme_ops.require_quota('ad_rivals',auth.uid()::text,30,3600);
 delete from adme_review.competitors where owner_id=auth.uid();
 insert into adme_review.competitors select auth.uid(),min(btrim(v#>>'{}')) from jsonb_array_elements(p_labels)v group by lower(btrim(v#>>'{}'));
 return adme_review.my_competitors();
end;$$;
create function public.set_ad_competitors(p_labels jsonb) returns jsonb language sql security invoker set search_path='' as $$select adme_review.set_competitors($1);$$;
create function adme_review.ad_page(p_creator text,p_brand text,p_category text,p_from date,p_to date,p_after jsonb,p_limit int) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; fingerprint jsonb;
begin
 if p_creator is null or length(p_creator) not between 1 and 100 or p_brand is null or length(p_brand)>100 or p_category is null or length(p_category)>50 or p_limit is null or p_limit not between 1 and 50 or p_from>p_to then raise invalid_parameter_value;end if;
 fingerprint:=jsonb_build_object('creator',p_creator,'brand',p_brand,'category',p_category,'from',p_from,'to',p_to);
 if p_after is not null and (jsonb_typeof(p_after) is distinct from 'object' or p_after->'filter' is distinct from fingerprint or not(p_after?'date' and p_after?'id') or (select count(*)from jsonb_object_keys(p_after))<>3)then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('ad_timeline',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 120 end,60);
 with visible as materialized(
 select c.id,r.payload,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind','ad','isDemo',c.is_demo,'payload',adme_review.public_payload('ad',r.payload),'classification','ad_evidence','summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
 'response',(select case when s.publish_consent then jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at)else null end from adme_review.responses s where s.case_id=c.id and s.version<=c.version order by s.created_at desc,s.id desc limit 1)) dto
 from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version join adme_review.decisions d on d.case_id=c.id and d.version=c.version join public.creators cr on cr.id=c.creator_id cross join adme_review.policy p
 where c.creator_id=adme_creator.resolve_reference(p_creator) and c.kind='ad' and c.status='approved' and c.public_visible and d.publish and d.classification='ad_evidence' and p.ad_enabled and d.policy_version=p.ad_version and adme_creator.catalog_dto(cr)is not null
 and r.payload->>'evidenceKind' in('paid_partnership_label','official_confirmation')and r.payload->>'interest'<>'unknown'
 and(p_brand=''or position(lower(p_brand)in lower(r.payload->>'brandLabel'))>0)and(p_category=''or r.payload->>'category'=p_category)
 and(p_from is null or(r.payload->>'endedOn')::date>=p_from)and(p_to is null or(r.payload->>'startedOn')::date<=p_to)
 ), page as(select *,row_number()over(order by payload->>'startedOn' desc,id desc)n from visible where p_after is null or ((payload->>'startedOn')::date,id)<((p_after->>'date')::date,(p_after->>'id')::uuid) order by payload->>'startedOn' desc,id desc limit p_limit+1)
 select jsonb_build_object('version',1,'items',coalesce((select jsonb_agg(jsonb_build_object('record',dto,'competitor',auth.uid()is not null and public.my_role()='brand' and exists(select 1 from adme_review.competitors v where v.owner_id=auth.uid()and lower(v.label)=lower(page.payload->>'brandLabel')))order by n)from page where n<=p_limit),'[]'::jsonb),'total',(select count(*)from visible),'nextCursor',(select jsonb_build_object('filter',fingerprint,'date',payload->>'startedOn','id',id)from page where n=p_limit and exists(select 1 from page where n>p_limit)))into result;
 return result;
end;$$;
create function public.ad_history_page(p_creator text,p_brand text default '',p_category text default '',p_from date default null,p_to date default null,p_after jsonb default null,p_limit int default 20)returns jsonb language sql security invoker set search_path='' as $$select adme_review.ad_page($1,$2,$3,$4,$5,$6,$7);$$;
revoke all on function adme_review.my_competitors(),public.my_ad_competitors(),adme_review.set_competitors(jsonb),public.set_ad_competitors(jsonb),adme_review.ad_page(text,text,text,date,date,jsonb,int),public.ad_history_page(text,text,text,date,date,jsonb,int)from public,anon,authenticated,service_role;
grant execute on function adme_review.my_competitors(),public.my_ad_competitors(),adme_review.set_competitors(jsonb),public.set_ad_competitors(jsonb)to authenticated;
grant execute on function adme_review.ad_page(text,text,text,date,date,jsonb,int),public.ad_history_page(text,text,text,date,date,jsonb,int)to anon,authenticated;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220062_metric_history.sql
-- D031: disclosed original time series; no unapproved YouTube-derived data.
alter table adme_creator.metric_observations add column formula_text text check(length(formula_text) between 1 and 500),add column sample_size int check(sample_size>0),add column period_start timestamptz,add column period_end timestamptz;
alter table adme_creator.metric_observations add constraint metric_period_pair check((period_start is null and period_end is null)or(period_start is not null and period_end is not null and isfinite(period_start)and isfinite(period_end)and period_start<=period_end));
alter table adme_creator.publication_policies add column derived_allowed boolean not null default false;
-- The existing current-value surface must enforce the same derived policy gate.
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.normalized_public(text)'::regprocedure)into body;
 if position('m.identity_id=i.id and m.policy_version=i.policy_version' in body)=0 then raise exception 'STOP: normalized read signature changed';end if;
 body:=replace(body,'m.identity_id=i.id and m.policy_version=i.policy_version','m.identity_id=i.id and m.policy_version=i.policy_version and(m.kind=''original''or(i.provider<>''youtube''and exists(select 1 from adme_creator.publication_policies dp where dp.provider=i.provider and dp.policy_version=i.policy_version and dp.enabled and dp.derived_allowed)and m.formula_text is not null and m.sample_size is not null and m.period_start is not null))');
 execute body;
end;$$;
create function adme_creator.metric_history(p_ref text,p_days int) returns jsonb language plpgsql security definer set search_path='' as $$
declare legacy public.creators; result jsonb;
begin
 if p_ref is null or length(p_ref)not between 1 and 100 or p_days is null or p_days not between 1 and 90 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('metric_history',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 120 end,60);
 select * into legacy from public.creators where id=adme_creator.resolve_reference(p_ref);
 if legacy.id is null or adme_creator.catalog_dto(legacy)is null then return null;end if;
 with visible as materialized(select i.*,p.ttl_seconds,p.metric_units,p.derived_allowed from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version and p.enabled where r.legacy_creator_id=legacy.id and legacy.owner_id is not null and legacy.profile->'owner_consent'='true'::jsonb and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()),
 identities as(select * from visible order by id limit 10)
 select jsonb_build_object('version',1,'creatorId',adme_creator.public_reference(legacy.id),'days',p_days,'asOf',statement_timestamp(),'truncated',(select count(*)>10 from visible),'identities',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'displayName',i.display_name,'canonicalUrl',i.canonical_url,'isDemo',legacy.profile->'is_demo','sourceType',i.source_type,'policyVersion',i.policy_version,'ttlSeconds',i.ttl_seconds,
 'points',coalesce((select jsonb_agg(x.dto order by x.observed_at,x.id)from(
 select m.id,m.observed_at,jsonb_build_object('name',m.name,'value',m.value,'unit',m.unit,'observedAt',m.observed_at,'collectedAt',m.collected_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind,'formula',m.formula_text,'sampleSize',m.sample_size,'periodStart',m.period_start,'periodEnd',m.period_end)dto
 from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit
 and m.observed_at>=statement_timestamp()-make_interval(days=>p_days)and m.observed_at<=statement_timestamp()and m.collected_at<=statement_timestamp()
 and(m.kind='original'or(i.provider<>'youtube'and i.derived_allowed and m.formula_text is not null and m.sample_size is not null and m.period_start is not null))
 order by m.observed_at desc,m.id desc limit 200)x),'[]'::jsonb),
 'pointsTruncated',(select count(*)>200 from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit and m.observed_at>=statement_timestamp()-make_interval(days=>p_days)and m.observed_at<=statement_timestamp()and m.collected_at<=statement_timestamp()and(m.kind='original'or(i.provider<>'youtube'and i.derived_allowed and m.formula_text is not null and m.sample_size is not null and m.period_start is not null)))
 )order by i.id)from identities i),'[]'::jsonb))into result;
 return result;
end;$$;
create function public.creator_metric_history(p_ref text,p_days int default 30)returns jsonb language sql security invoker set search_path='' as $$select adme_creator.metric_history($1,$2);$$;
revoke all on function adme_creator.metric_history(text,int),public.creator_metric_history(text,int)from public,anon,authenticated,service_role;
grant execute on function adme_creator.metric_history(text,int),public.creator_metric_history(text,int)to anon,authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220062','metric_history',array[$ready_source$-- D031: disclosed original time series; no unapproved YouTube-derived data.
begin;
alter table adme_creator.metric_observations add column formula_text text check(length(formula_text) between 1 and 500),add column sample_size int check(sample_size>0),add column period_start timestamptz,add column period_end timestamptz;
alter table adme_creator.metric_observations add constraint metric_period_pair check((period_start is null and period_end is null)or(period_start is not null and period_end is not null and isfinite(period_start)and isfinite(period_end)and period_start<=period_end));
alter table adme_creator.publication_policies add column derived_allowed boolean not null default false;
-- The existing current-value surface must enforce the same derived policy gate.
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.normalized_public(text)'::regprocedure)into body;
 if position('m.identity_id=i.id and m.policy_version=i.policy_version' in body)=0 then raise exception 'STOP: normalized read signature changed';end if;
 body:=replace(body,'m.identity_id=i.id and m.policy_version=i.policy_version','m.identity_id=i.id and m.policy_version=i.policy_version and(m.kind=''original''or(i.provider<>''youtube''and exists(select 1 from adme_creator.publication_policies dp where dp.provider=i.provider and dp.policy_version=i.policy_version and dp.enabled and dp.derived_allowed)and m.formula_text is not null and m.sample_size is not null and m.period_start is not null))');
 execute body;
end;$$;
create function adme_creator.metric_history(p_ref text,p_days int) returns jsonb language plpgsql security definer set search_path='' as $$
declare legacy public.creators; result jsonb;
begin
 if p_ref is null or length(p_ref)not between 1 and 100 or p_days is null or p_days not between 1 and 90 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('metric_history',coalesce(auth.uid()::text,'anonymous'),case when auth.uid()is null then 300 else 120 end,60);
 select * into legacy from public.creators where id=adme_creator.resolve_reference(p_ref);
 if legacy.id is null or adme_creator.catalog_dto(legacy)is null then return null;end if;
 with visible as materialized(select i.*,p.ttl_seconds,p.metric_units,p.derived_allowed from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version and p.enabled where r.legacy_creator_id=legacy.id and legacy.owner_id is not null and legacy.profile->'owner_consent'='true'::jsonb and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()),
 identities as(select * from visible order by id limit 10)
 select jsonb_build_object('version',1,'creatorId',adme_creator.public_reference(legacy.id),'days',p_days,'asOf',statement_timestamp(),'truncated',(select count(*)>10 from visible),'identities',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'displayName',i.display_name,'canonicalUrl',i.canonical_url,'isDemo',legacy.profile->'is_demo','sourceType',i.source_type,'policyVersion',i.policy_version,'ttlSeconds',i.ttl_seconds,
 'points',coalesce((select jsonb_agg(x.dto order by x.observed_at,x.id)from(
 select m.id,m.observed_at,jsonb_build_object('name',m.name,'value',m.value,'unit',m.unit,'observedAt',m.observed_at,'collectedAt',m.collected_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind,'formula',m.formula_text,'sampleSize',m.sample_size,'periodStart',m.period_start,'periodEnd',m.period_end)dto
 from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit
 and m.observed_at>=statement_timestamp()-make_interval(days=>p_days)and m.observed_at<=statement_timestamp()and m.collected_at<=statement_timestamp()
 and(m.kind='original'or(i.provider<>'youtube'and i.derived_allowed and m.formula_text is not null and m.sample_size is not null and m.period_start is not null))
 order by m.observed_at desc,m.id desc limit 200)x),'[]'::jsonb),
 'pointsTruncated',(select count(*)>200 from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit and m.observed_at>=statement_timestamp()-make_interval(days=>p_days)and m.observed_at<=statement_timestamp()and m.collected_at<=statement_timestamp()and(m.kind='original'or(i.provider<>'youtube'and i.derived_allowed and m.formula_text is not null and m.sample_size is not null and m.period_start is not null)))
 )order by i.id)from identities i),'[]'::jsonb))into result;
 return result;
end;$$;
create function public.creator_metric_history(p_ref text,p_days int default 30)returns jsonb language sql security invoker set search_path='' as $$select adme_creator.metric_history($1,$2);$$;
revoke all on function adme_creator.metric_history(text,int),public.creator_metric_history(text,int)from public,anon,authenticated,service_role;
grant execute on function adme_creator.metric_history(text,int),public.creator_metric_history(text,int)to anon,authenticated;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220063_ad_cursor_reference.sql
-- D030: legacy lookups may not echo an actor-based ID in pagination metadata.
do $$declare body text;begin
 select pg_get_functiondef('adme_review.ad_page(text,text,text,date,date,jsonb,int)'::regprocedure)into body;
 if position('''creator'',p_creator' in body)=0 then raise exception 'STOP: ad cursor contract changed';end if;
 execute replace(body,'''creator'',p_creator','''creator'',adme_creator.public_reference(adme_creator.resolve_reference(p_creator))');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220063','ad_cursor_reference',array[$ready_source$-- D030: legacy lookups may not echo an actor-based ID in pagination metadata.
begin;
do $$declare body text;begin
 select pg_get_functiondef('adme_review.ad_page(text,text,text,date,date,jsonb,int)'::regprocedure)into body;
 if position('''creator'',p_creator' in body)=0 then raise exception 'STOP: ad cursor contract changed';end if;
 execute replace(body,'''creator'',p_creator','''creator'',adme_creator.public_reference(adme_creator.resolve_reference(p_creator))');
end;$$;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220064_metric_filters.sql
-- D035: only fresh, permissioned, disclosed, non-YouTube engagement may filter.
create function adme_creator.engagement_value(p_legacy text)returns double precision language sql stable security definer set search_path='' as $$
 select max(m.value)from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id join adme_creator.identities i on i.creator_id=r.id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version
 cross join lateral(select m.* from adme_creator.metric_observations m where m.identity_id=i.id and m.name='engagement_rate'and m.kind='derived'and m.policy_version=i.policy_version order by m.observed_at desc,m.id desc limit 1)m
 where c.id=p_legacy and adme_creator.catalog_dto(c)is not null and c.owner_id is not null and c.profile->'owner_consent'='true'::jsonb and i.provider<>'youtube'and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()
 and p.enabled and p.derived_allowed and p.metric_units->>'engagement_rate'='percent'and m.unit='percent'and m.sample_size>=2 and m.formula_text is not null and m.period_start is not null and m.period_end<=m.observed_at
 and m.observed_at between statement_timestamp()-make_interval(secs=>p.ttl_seconds)and statement_timestamp()and m.collected_at<=statement_timestamp();
$$;
create function adme_creator.metric_filter_meta(p_demo boolean)returns jsonb language sql stable security definer set search_path='' as $$
 with available as materialized(select c.id from public.creators c where(p_demo or c.profile->'is_demo'='false'::jsonb)and adme_creator.engagement_value(c.id)is not null)
 select jsonb_build_object('engagement',jsonb_build_object('available',exists(select 1 from available),'profiles',(select count(*)from available),'unit','percent','minimumSample',2,'rule','any_permissioned_non_youtube_identity','definitions',coalesce((select jsonb_agg(x.d)from(select distinct jsonb_build_object('provider',i.provider,'policyVersion',i.policy_version,'formula',m.formula_text) d from available a join adme_creator.records r on r.legacy_creator_id=a.id join adme_creator.identities i on i.creator_id=r.id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version
 cross join lateral(select * from adme_creator.metric_observations m where m.identity_id=i.id and m.name='engagement_rate'and m.kind='derived'and m.policy_version=i.policy_version order by m.observed_at desc,m.id desc limit 1)m
 where i.provider<>'youtube'and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and p.enabled and p.derived_allowed and p.metric_units->>'engagement_rate'='percent'and m.unit='percent'and m.sample_size>=2 and m.formula_text is not null and m.period_start is not null and m.period_end<=m.observed_at and m.observed_at between statement_timestamp()-make_interval(secs=>p.ttl_seconds)and statement_timestamp()and m.collected_at<=statement_timestamp() order by d limit 20)x),'[]'::jsonb)),'age',jsonb_build_object('available',false,'reason','not_collected'),'gender',jsonb_build_object('available',false,'reason','not_collected'));
$$;
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.filtered_page(jsonb,text,integer,boolean)'::regprocedure)into body;
 if position('''available'',''sort''))'in body)=0 or position('return result;'in body)=0 then raise exception 'STOP: filtered contract changed';end if;
 body:=replace(body,'begin'||chr(10)||' if f is null','begin'||chr(10)||' if f is not null and jsonb_typeof(f)=''object''then f:=jsonb_build_object(''minEngagement'','''')||f;end if;'||chr(10)||' if f is null');
 body:=replace(body,'''available'',''sort''))','''available'',''sort'',''minEngagement''))');
 body:=replace(body,' signature:=md5',' if jsonb_typeof(f->''minEngagement'')is distinct from ''string''or(f->>''minEngagement''<>''''and(f->>''minEngagement''!~ ''^[0-9]{1,3}$''or(f->>''minEngagement'')::int>100))then raise invalid_parameter_value;end if;'||chr(10)||' signature:=md5');
 body:=replace(body,' filtered as materialized(select d,',' metric_visible as(select d from visible where f->>''minEngagement''=''''or adme_creator.engagement_value(adme_creator.resolve_reference(d->>''seed_id''))>=(f->>''minEngagement'')::numeric),'||chr(10)||' filtered as materialized(select d,');
 body:=replace(body,'else 0 end k from visible','else 0 end k from metric_visible');
 body:=replace(body,' return result;',' return result||jsonb_build_object(''metrics'',adme_creator.metric_filter_meta(p_demo));');
 execute body;
end;$$;
revoke all on function adme_creator.engagement_value(text),adme_creator.metric_filter_meta(boolean)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220064','metric_filters',array[$ready_source$-- D035: only fresh, permissioned, disclosed, non-YouTube engagement may filter.
begin;
create function adme_creator.engagement_value(p_legacy text)returns double precision language sql stable security definer set search_path='' as $$
 select max(m.value)from public.creators c join adme_creator.records r on r.legacy_creator_id=c.id join adme_creator.identities i on i.creator_id=r.id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version
 cross join lateral(select m.* from adme_creator.metric_observations m where m.identity_id=i.id and m.name='engagement_rate'and m.kind='derived'and m.policy_version=i.policy_version order by m.observed_at desc,m.id desc limit 1)m
 where c.id=p_legacy and adme_creator.catalog_dto(c)is not null and c.owner_id is not null and c.profile->'owner_consent'='true'::jsonb and i.provider<>'youtube'and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()
 and p.enabled and p.derived_allowed and p.metric_units->>'engagement_rate'='percent'and m.unit='percent'and m.sample_size>=2 and m.formula_text is not null and m.period_start is not null and m.period_end<=m.observed_at
 and m.observed_at between statement_timestamp()-make_interval(secs=>p.ttl_seconds)and statement_timestamp()and m.collected_at<=statement_timestamp();
$$;
create function adme_creator.metric_filter_meta(p_demo boolean)returns jsonb language sql stable security definer set search_path='' as $$
 with available as materialized(select c.id from public.creators c where(p_demo or c.profile->'is_demo'='false'::jsonb)and adme_creator.engagement_value(c.id)is not null)
 select jsonb_build_object('engagement',jsonb_build_object('available',exists(select 1 from available),'profiles',(select count(*)from available),'unit','percent','minimumSample',2,'rule','any_permissioned_non_youtube_identity','definitions',coalesce((select jsonb_agg(x.d)from(select distinct jsonb_build_object('provider',i.provider,'policyVersion',i.policy_version,'formula',m.formula_text) d from available a join adme_creator.records r on r.legacy_creator_id=a.id join adme_creator.identities i on i.creator_id=r.id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version
 cross join lateral(select * from adme_creator.metric_observations m where m.identity_id=i.id and m.name='engagement_rate'and m.kind='derived'and m.policy_version=i.policy_version order by m.observed_at desc,m.id desc limit 1)m
 where i.provider<>'youtube'and i.claim_status='claimed'and i.owner_consent and i.publication_status='published'and i.moderation_status='allowed'and p.enabled and p.derived_allowed and p.metric_units->>'engagement_rate'='percent'and m.unit='percent'and m.sample_size>=2 and m.formula_text is not null and m.period_start is not null and m.period_end<=m.observed_at and m.observed_at between statement_timestamp()-make_interval(secs=>p.ttl_seconds)and statement_timestamp()and m.collected_at<=statement_timestamp() order by d limit 20)x),'[]'::jsonb)),'age',jsonb_build_object('available',false,'reason','not_collected'),'gender',jsonb_build_object('available',false,'reason','not_collected'));
$$;
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.filtered_page(jsonb,text,integer,boolean)'::regprocedure)into body;
 if position('''available'',''sort''))'in body)=0 or position('return result;'in body)=0 then raise exception 'STOP: filtered contract changed';end if;
 body:=replace(body,'begin'||chr(10)||' if f is null','begin'||chr(10)||' if f is not null and jsonb_typeof(f)=''object''then f:=jsonb_build_object(''minEngagement'','''')||f;end if;'||chr(10)||' if f is null');
 body:=replace(body,'''available'',''sort''))','''available'',''sort'',''minEngagement''))');
 body:=replace(body,' signature:=md5',' if jsonb_typeof(f->''minEngagement'')is distinct from ''string''or(f->>''minEngagement''<>''''and(f->>''minEngagement''!~ ''^[0-9]{1,3}$''or(f->>''minEngagement'')::int>100))then raise invalid_parameter_value;end if;'||chr(10)||' signature:=md5');
 body:=replace(body,' filtered as materialized(select d,',' metric_visible as(select d from visible where f->>''minEngagement''=''''or adme_creator.engagement_value(adme_creator.resolve_reference(d->>''seed_id''))>=(f->>''minEngagement'')::numeric),'||chr(10)||' filtered as materialized(select d,');
 body:=replace(body,'else 0 end k from visible','else 0 end k from metric_visible');
 body:=replace(body,' return result;',' return result||jsonb_build_object(''metrics'',adme_creator.metric_filter_meta(p_demo));');
 execute body;
end;$$;
revoke all on function adme_creator.engagement_value(text),adme_creator.metric_filter_meta(boolean)from public,anon,authenticated,service_role;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220065_admin_support.sql
-- D060: scoped support search, no raw JSON/secrets; append-only purpose/action audit.
create table adme_ops.support_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null check(length(action)between 1 and 80),target text not null check(length(target)between 1 and 160),request_id uuid not null,reason text not null check(length(btrim(reason))between 5 and 500),created_at timestamptz not null default statement_timestamp());
create index on adme_ops.support_audit(created_at desc,id desc);
alter table adme_ops.support_audit enable row level security;
revoke all on adme_ops.support_audit from public,anon,authenticated,service_role;
create function adme_ops.guard_support_audit()returns trigger language plpgsql set search_path=''as $$begin raise exception 'support audit is append only'using errcode='42501';end;$$;
create trigger support_audit_immutable before update or delete on adme_ops.support_audit for each row execute function adme_ops.guard_support_audit();
create function adme_ops.support_log(p_action text,p_target text,p_request uuid,p_reason text)returns void language plpgsql security definer set search_path=''as $$
begin
 if adme_ops.staff_role()is null then raise insufficient_privilege;end if;
 if p_request is null or p_reason is null or length(btrim(p_reason))not between 5 and 500 then raise invalid_parameter_value;end if;
 insert into adme_ops.support_audit(actor_id,action,target,request_id,reason)values(auth.uid(),p_action,p_target,p_request,btrim(p_reason));
end;$$;
create function adme_ops.support_search(p_kind text,p_query text,p_after jsonb,p_limit int,p_reason text,p_request uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare role_name text:=adme_ops.staff_role(); result jsonb;
begin
 if role_name is null or not(case p_kind when'members'then role_name in('super','support')when'creators'then role_name in('super','content')when'campaigns'then role_name in('super','campaign')when'jobs'then role_name in('super','content')when'reports'then role_name in('super','support')when'orders'then role_name in('super','finance')when'audit'then role_name='super'else false end)then raise insufficient_privilege;end if;
 if p_query is null or length(p_query)>100 or p_limit is null or p_limit not between 1 and 50 or p_request is null or p_reason is null or length(btrim(p_reason))not between 5 and 500 then raise invalid_parameter_value;end if;
 if p_after is not null and(jsonb_typeof(p_after)is distinct from'object'or p_after->>'kind'is distinct from p_kind or p_after->>'query'is distinct from p_query or not(p_after?'id'and p_after?'at')or(select count(*)from jsonb_object_keys(p_after))<>4)then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('support_search',auth.uid()::text,60,60);
 with source as materialized(
 select id::text id,left(name,80)label,role status,created_at,jsonb_build_object('role',role)details from public.profiles where p_kind='members'
 union all select id,left(profile->>'name',80),moderation_status,created_at,jsonb_build_object('published',published,'moderation',moderation_status,'isDemo',profile->'is_demo')from public.creators where p_kind='creators'
 union all select id::text,left(brief->>'title',100),status,created_at,jsonb_build_object('moderation',moderation_status,'isDemo',is_demo)from public.campaigns where p_kind='campaigns'
 union all select id::text,kind,status,created_at,jsonb_build_object('attempts',attempts)from adme_ops.jobs where p_kind='jobs'
 union all select id::text,'이전 접수 신고',status,created_at,'{}'::jsonb from public.reports where p_kind='reports'
 union all select id::text,sku,status,created_at,jsonb_build_object('amount',amount,'test',true)from public.orders where p_kind='orders'and exists(select 1 from adme_release.billing_boundary where enabled)
 union all select id::text,action,'기록',created_at,jsonb_build_object('actor',actor_id,'target',target,'requestId',request_id,'reason',reason)from adme_ops.support_audit where p_kind='audit'
 ), filtered as(select *from source where p_query=''or position(lower(p_query)in lower(coalesce(label,'')||' '||id||' '||status))>0),
 page as(select *,row_number()over(order by created_at desc,id desc)n from filtered where p_after is null or(created_at,id)<((p_after->>'at')::timestamptz,p_after->>'id')order by created_at desc,id desc limit p_limit+1)
 select jsonb_build_object('version',1,'kind',p_kind,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',coalesce(label,''),'status',status,'createdAt',created_at,'details',details)order by n)from page where n<=p_limit),'[]'::jsonb),'nextCursor',(select jsonb_build_object('kind',p_kind,'query',p_query,'at',created_at,'id',id)from page where n=p_limit and exists(select 1 from page where n>p_limit)))into result;
 perform adme_ops.support_log('search:'||p_kind,p_kind,p_request,p_reason);
 return result;
end;$$;
create function public.admin_support_search(p_kind text,p_query text default '',p_after jsonb default null,p_limit int default 20,p_reason text default null,p_request uuid default null)returns jsonb language sql security invoker set search_path=''as $$select adme_ops.support_search($1,$2,$3,$4,$5,$6);$$;
create function public.admin_review_report(p_id uuid,p_status text,p_reason text,p_request uuid)returns void language plpgsql security definer set search_path=''as $$
begin
 if not public.is_admin()then raise insufficient_privilege;end if;
 if p_status is null or p_status not in('reviewed','dismissed')then raise invalid_parameter_value;end if;
 perform adme_ops.support_log('report:'||p_status,p_id::text,p_request,p_reason);
 update public.reports set status=p_status where id=p_id;
 if not found then raise no_data_found;end if;
 insert into public.audit_log(actor_id,entity_id,action)values(auth.uid(),p_id::text,'report:'||p_status);
end;$$;
-- Old clients must supply a reason; they cannot bypass the new action audit.
create or replace function public.review_report(p_id uuid,p_status text)returns void language plpgsql security definer set search_path=''as $$begin if not public.is_admin()then raise insufficient_privilege;end if;raise exception 'reason and request ID required'using errcode='22023';end;$$;
do $$declare body text;begin
 select pg_get_functiondef('public.moderate_entity(text,text,boolean,text)'::regprocedure)into body;
 if position('if previous=desired then return; end if;'in body)=0 then raise exception 'STOP: moderation contract changed';end if;
 execute replace(body,'if previous=desired then return; end if;','perform adme_ops.support_log(''moderate:''||p_kind||'':''||desired,p_id,coalesce(nullif(current_setting(''adme.support_request'',true),'''')::uuid,gen_random_uuid()),p_reason); if previous=desired then return; end if;');
end;$$;
create function public.admin_moderate_entity(p_kind text,p_id text,p_published boolean,p_reason text,p_request uuid)returns void language plpgsql security definer set search_path=''as $$begin
 if not public.is_admin()then raise insufficient_privilege;end if;if p_request is null then raise invalid_parameter_value;end if;
 perform set_config('adme.support_request',p_request::text,true);perform public.moderate_entity(p_kind,p_id,p_published,p_reason);
end;$$;
revoke all on function adme_ops.guard_support_audit(),adme_ops.support_log(text,text,uuid,text),adme_ops.support_search(text,text,jsonb,int,text,uuid),public.admin_support_search(text,text,jsonb,int,text,uuid),public.admin_review_report(uuid,text,text,uuid)from public,anon,authenticated,service_role;
revoke all on function public.admin_moderate_entity(text,text,boolean,text,uuid)from public,anon,authenticated,service_role;
grant execute on function adme_ops.support_search(text,text,jsonb,int,text,uuid),public.admin_support_search(text,text,jsonb,int,text,uuid),public.admin_review_report(uuid,text,text,uuid),public.admin_moderate_entity(text,text,boolean,text,uuid)to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220065','admin_support',array[$ready_source$-- D060: scoped support search, no raw JSON/secrets; append-only purpose/action audit.
begin;
create table adme_ops.support_audit(id uuid primary key default gen_random_uuid(),actor_id uuid not null,action text not null check(length(action)between 1 and 80),target text not null check(length(target)between 1 and 160),request_id uuid not null,reason text not null check(length(btrim(reason))between 5 and 500),created_at timestamptz not null default statement_timestamp());
create index on adme_ops.support_audit(created_at desc,id desc);
alter table adme_ops.support_audit enable row level security;
revoke all on adme_ops.support_audit from public,anon,authenticated,service_role;
create function adme_ops.guard_support_audit()returns trigger language plpgsql set search_path=''as $$begin raise exception 'support audit is append only'using errcode='42501';end;$$;
create trigger support_audit_immutable before update or delete on adme_ops.support_audit for each row execute function adme_ops.guard_support_audit();
create function adme_ops.support_log(p_action text,p_target text,p_request uuid,p_reason text)returns void language plpgsql security definer set search_path=''as $$
begin
 if adme_ops.staff_role()is null then raise insufficient_privilege;end if;
 if p_request is null or p_reason is null or length(btrim(p_reason))not between 5 and 500 then raise invalid_parameter_value;end if;
 insert into adme_ops.support_audit(actor_id,action,target,request_id,reason)values(auth.uid(),p_action,p_target,p_request,btrim(p_reason));
end;$$;
create function adme_ops.support_search(p_kind text,p_query text,p_after jsonb,p_limit int,p_reason text,p_request uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare role_name text:=adme_ops.staff_role(); result jsonb;
begin
 if role_name is null or not(case p_kind when'members'then role_name in('super','support')when'creators'then role_name in('super','content')when'campaigns'then role_name in('super','campaign')when'jobs'then role_name in('super','content')when'reports'then role_name in('super','support')when'orders'then role_name in('super','finance')when'audit'then role_name='super'else false end)then raise insufficient_privilege;end if;
 if p_query is null or length(p_query)>100 or p_limit is null or p_limit not between 1 and 50 or p_request is null or p_reason is null or length(btrim(p_reason))not between 5 and 500 then raise invalid_parameter_value;end if;
 if p_after is not null and(jsonb_typeof(p_after)is distinct from'object'or p_after->>'kind'is distinct from p_kind or p_after->>'query'is distinct from p_query or not(p_after?'id'and p_after?'at')or(select count(*)from jsonb_object_keys(p_after))<>4)then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('support_search',auth.uid()::text,60,60);
 with source as materialized(
 select id::text id,left(name,80)label,role status,created_at,jsonb_build_object('role',role)details from public.profiles where p_kind='members'
 union all select id,left(profile->>'name',80),moderation_status,created_at,jsonb_build_object('published',published,'moderation',moderation_status,'isDemo',profile->'is_demo')from public.creators where p_kind='creators'
 union all select id::text,left(brief->>'title',100),status,created_at,jsonb_build_object('moderation',moderation_status,'isDemo',is_demo)from public.campaigns where p_kind='campaigns'
 union all select id::text,kind,status,created_at,jsonb_build_object('attempts',attempts)from adme_ops.jobs where p_kind='jobs'
 union all select id::text,'이전 접수 신고',status,created_at,'{}'::jsonb from public.reports where p_kind='reports'
 union all select id::text,sku,status,created_at,jsonb_build_object('amount',amount,'test',true)from public.orders where p_kind='orders'and exists(select 1 from adme_release.billing_boundary where enabled)
 union all select id::text,action,'기록',created_at,jsonb_build_object('actor',actor_id,'target',target,'requestId',request_id,'reason',reason)from adme_ops.support_audit where p_kind='audit'
 ), filtered as(select *from source where p_query=''or position(lower(p_query)in lower(coalesce(label,'')||' '||id||' '||status))>0),
 page as(select *,row_number()over(order by created_at desc,id desc)n from filtered where p_after is null or(created_at,id)<((p_after->>'at')::timestamptz,p_after->>'id')order by created_at desc,id desc limit p_limit+1)
 select jsonb_build_object('version',1,'kind',p_kind,'items',coalesce((select jsonb_agg(jsonb_build_object('id',id,'label',coalesce(label,''),'status',status,'createdAt',created_at,'details',details)order by n)from page where n<=p_limit),'[]'::jsonb),'nextCursor',(select jsonb_build_object('kind',p_kind,'query',p_query,'at',created_at,'id',id)from page where n=p_limit and exists(select 1 from page where n>p_limit)))into result;
 perform adme_ops.support_log('search:'||p_kind,p_kind,p_request,p_reason);
 return result;
end;$$;
create function public.admin_support_search(p_kind text,p_query text default '',p_after jsonb default null,p_limit int default 20,p_reason text default null,p_request uuid default null)returns jsonb language sql security invoker set search_path=''as $$select adme_ops.support_search($1,$2,$3,$4,$5,$6);$$;
create function public.admin_review_report(p_id uuid,p_status text,p_reason text,p_request uuid)returns void language plpgsql security definer set search_path=''as $$
begin
 if not public.is_admin()then raise insufficient_privilege;end if;
 if p_status is null or p_status not in('reviewed','dismissed')then raise invalid_parameter_value;end if;
 perform adme_ops.support_log('report:'||p_status,p_id::text,p_request,p_reason);
 update public.reports set status=p_status where id=p_id;
 if not found then raise no_data_found;end if;
 insert into public.audit_log(actor_id,entity_id,action)values(auth.uid(),p_id::text,'report:'||p_status);
end;$$;
-- Old clients must supply a reason; they cannot bypass the new action audit.
create or replace function public.review_report(p_id uuid,p_status text)returns void language plpgsql security definer set search_path=''as $$begin if not public.is_admin()then raise insufficient_privilege;end if;raise exception 'reason and request ID required'using errcode='22023';end;$$;
do $$declare body text;begin
 select pg_get_functiondef('public.moderate_entity(text,text,boolean,text)'::regprocedure)into body;
 if position('if previous=desired then return; end if;'in body)=0 then raise exception 'STOP: moderation contract changed';end if;
 execute replace(body,'if previous=desired then return; end if;','perform adme_ops.support_log(''moderate:''||p_kind||'':''||desired,p_id,coalesce(nullif(current_setting(''adme.support_request'',true),'''')::uuid,gen_random_uuid()),p_reason); if previous=desired then return; end if;');
end;$$;
create function public.admin_moderate_entity(p_kind text,p_id text,p_published boolean,p_reason text,p_request uuid)returns void language plpgsql security definer set search_path=''as $$begin
 if not public.is_admin()then raise insufficient_privilege;end if;if p_request is null then raise invalid_parameter_value;end if;
 perform set_config('adme.support_request',p_request::text,true);perform public.moderate_entity(p_kind,p_id,p_published,p_reason);
end;$$;
revoke all on function adme_ops.guard_support_audit(),adme_ops.support_log(text,text,uuid,text),adme_ops.support_search(text,text,jsonb,int,text,uuid),public.admin_support_search(text,text,jsonb,int,text,uuid),public.admin_review_report(uuid,text,text,uuid)from public,anon,authenticated,service_role;
revoke all on function public.admin_moderate_entity(text,text,boolean,text,uuid)from public,anon,authenticated,service_role;
grant execute on function adme_ops.support_search(text,text,jsonb,int,text,uuid),public.admin_support_search(text,text,jsonb,int,text,uuid),public.admin_review_report(uuid,text,text,uuid),public.admin_moderate_entity(text,text,boolean,text,uuid)to authenticated;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220066_metric_metadata_guard.sql
-- D031/D035: derived periods and metadata obey observation time, including facets.
do $$declare body text; signature text;begin
 foreach signature in array array['adme_creator.metric_history(text,integer)','adme_creator.normalized_public(text)']loop
  select pg_get_functiondef(signature::regprocedure)into body;
  if position('m.period_start is not null' in body)=0 then raise exception 'STOP: reviewed derived metadata required';end if;
  execute replace(body,'m.period_start is not null','m.period_start is not null and m.period_end<=m.observed_at');
 end loop;
 select pg_get_functiondef('adme_creator.metric_filter_meta(boolean)'::regprocedure)into body;
 if position('i.moderation_status=''allowed'''in body)=0 then raise exception 'STOP: reviewed metric facets required';end if;
 execute replace(body,'i.moderation_status=''allowed''','i.moderation_status=''allowed''and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()');
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220066','metric_metadata_guard',array[$ready_source$-- D031/D035: derived periods and metadata obey observation time, including facets.
begin;
do $$declare body text; signature text;begin
 foreach signature in array array['adme_creator.metric_history(text,integer)','adme_creator.normalized_public(text)']loop
  select pg_get_functiondef(signature::regprocedure)into body;
  if position('m.period_start is not null' in body)=0 then raise exception 'STOP: reviewed derived metadata required';end if;
  execute replace(body,'m.period_start is not null','m.period_start is not null and m.period_end<=m.observed_at');
 end loop;
 select pg_get_functiondef('adme_creator.metric_filter_meta(boolean)'::regprocedure)into body;
 if position('i.moderation_status=''allowed'''in body)=0 then raise exception 'STOP: reviewed metric facets required';end if;
 execute replace(body,'i.moderation_status=''allowed''','i.moderation_status=''allowed''and i.observed_at<=statement_timestamp()and i.collected_at<=statement_timestamp()');
end;$$;
notify pgrst,'reload schema';
commit;
$ready_source$]);

-- SOURCE 202611220067_history_permission.sql
-- D031: approval for a current value does not implicitly approve a history feed.
alter table adme_creator.publication_policies add column history_allowed boolean not null default false,add column history_window_seconds int not null default 86400 check(history_window_seconds between 3600 and 2592000),add column history_permission_ref text;
alter table adme_creator.publication_policies add constraint history_permission_required check(not history_allowed or(history_permission_ref is not null and length(btrim(history_permission_ref))between 7 and 200));
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.metric_history(text,integer)'::regprocedure)into body;
 if position('p.enabled where' in body)=0 or position('make_interval(days=>p_days)'in body)=0 then raise exception 'STOP: reviewed metric history contract required';end if;
 body:=replace(body,'p.derived_allowed from','p.derived_allowed,p.history_window_seconds from');
 body:=replace(body,'p.enabled where','p.enabled and p.history_allowed where');
 body:=replace(body,'make_interval(days=>p_days)','make_interval(secs=>least(p_days*86400,i.history_window_seconds))');
 body:=replace(body,'''ttlSeconds'',i.ttl_seconds','''ttlSeconds'',i.ttl_seconds,''historyWindowSeconds'',i.history_window_seconds');
 execute body;
end;$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements)values('202611220067','history_permission',array[$ready_source$-- D031: approval for a current value does not implicitly approve a history feed.
begin;
alter table adme_creator.publication_policies add column history_allowed boolean not null default false,add column history_window_seconds int not null default 86400 check(history_window_seconds between 3600 and 2592000),add column history_permission_ref text;
alter table adme_creator.publication_policies add constraint history_permission_required check(not history_allowed or(history_permission_ref is not null and length(btrim(history_permission_ref))between 7 and 200));
do $$declare body text;begin
 select pg_get_functiondef('adme_creator.metric_history(text,integer)'::regprocedure)into body;
 if position('p.enabled where' in body)=0 or position('make_interval(days=>p_days)'in body)=0 then raise exception 'STOP: reviewed metric history contract required';end if;
 body:=replace(body,'p.derived_allowed from','p.derived_allowed,p.history_window_seconds from');
 body:=replace(body,'p.enabled where','p.enabled and p.history_allowed where');
 body:=replace(body,'make_interval(days=>p_days)','make_interval(secs=>least(p_days*86400,i.history_window_seconds))');
 body:=replace(body,'''ttlSeconds'',i.ttl_seconds','''ttlSeconds'',i.ttl_seconds,''historyWindowSeconds'',i.history_window_seconds');
 execute body;
end;$$;
notify pgrst,'reload schema';
commit;
$ready_source$]);
commit;
