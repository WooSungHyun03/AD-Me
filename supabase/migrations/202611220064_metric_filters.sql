-- D035: only fresh, permissioned, disclosed, non-YouTube engagement may filter.
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
