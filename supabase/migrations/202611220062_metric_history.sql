-- D031: disclosed original time series; no unapproved YouTube-derived data.
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
