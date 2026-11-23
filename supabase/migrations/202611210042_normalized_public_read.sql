-- D018: explicit provider policy gate, current consent and latest observations.
begin;
create function adme_creator.valid_metric_policy(p jsonb) returns boolean language sql immutable set search_path='' as $$select jsonb_typeof(p)='object' and(select count(*)<=20 and coalesce(bool_and(k ~ '^[a-z][a-z0-9_]{0,79}$' and v in('count','percent','ratio')),true) from jsonb_each_text(p) t(k,v));$$;
create table adme_creator.publication_policies(provider text not null check(provider in('youtube','instagram','tiktok','approved_web')),policy_version text not null,enabled boolean not null default false,permission_ref text not null check(length(btrim(permission_ref)) between 7 and 200),ttl_seconds int not null check(ttl_seconds between 60 and 2592000),metric_units jsonb not null default '{}' check(adme_creator.valid_metric_policy(metric_units)),primary key(provider,policy_version));
alter table adme_creator.publication_policies enable row level security;
revoke all on adme_creator.publication_policies from public,anon,authenticated,service_role;
create function adme_creator.normalized_public(p_ref text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare legacy public.creators; entries jsonb; total int;
begin
 if p_ref is null or length(p_ref) not between 1 and 100 then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('creator_catalog',coalesce(auth.uid()::text,'anonymous'),case when auth.uid() is null then 300 else 60 end,60);
 select * into legacy from public.creators where id=adme_creator.resolve_reference(p_ref);
 if legacy.id is null or adme_creator.catalog_dto(legacy) is null then return null;end if;
 with visible as materialized(select i.*,p.ttl_seconds,p.metric_units from adme_creator.identities i join adme_creator.records r on r.id=i.creator_id join adme_creator.publication_policies p on p.provider=i.provider and p.policy_version=i.policy_version and p.enabled where r.legacy_creator_id=legacy.id and legacy.owner_id is not null and legacy.profile->'owner_consent'='true'::jsonb and i.claim_status='claimed' and i.owner_consent and i.publication_status='published' and i.moderation_status='allowed' and i.observed_at<=statement_timestamp() and i.collected_at<=statement_timestamp()),
 page as(select * from visible order by id limit 10)
 select coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'provider',i.provider,'handle',i.handle,'displayName',i.display_name,'canonicalUrl',i.canonical_url,'observedAt',i.observed_at,'isDemo',legacy.profile->'is_demo','sourceType',i.source_type,'policyVersion',i.policy_version,'canRequestCollaboration',legacy.profile->'is_demo'='false'::jsonb,
 'metrics',coalesce((select jsonb_agg(jsonb_build_object('name',m.name,'value',case when m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds) then null else m.value end,'unit',m.unit,'observedAt',m.observed_at,'collectedAt',m.collected_at,'sourceUrl',m.source_url,'policyVersion',m.policy_version,'kind',m.kind,'stale',m.observed_at<statement_timestamp()-make_interval(secs=>i.ttl_seconds)) order by m.name,m.kind) from(select distinct on(name,kind) m.* from adme_creator.metric_observations m where m.identity_id=i.id and m.policy_version=i.policy_version and i.metric_units->>m.name=m.unit and m.observed_at<=statement_timestamp() and m.collected_at<=statement_timestamp() order by name,kind,observed_at desc,id desc) m),'[]'::jsonb)) order by i.id) from page i),'[]'::jsonb),(select count(*) from visible) into entries,total;
 return jsonb_build_object('version',1,'creatorId',adme_creator.public_reference(legacy.id),'identities',entries,'truncated',total>10);
end;$$;
create function public.creator_normalized_public(p_ref text) returns jsonb language sql volatile security invoker set search_path='' as $$select adme_creator.normalized_public($1);$$;
revoke all on function adme_creator.valid_metric_policy(jsonb),adme_creator.normalized_public(text),public.creator_normalized_public(text) from public,anon,authenticated,service_role;
grant execute on function adme_creator.normalized_public(text),public.creator_normalized_public(text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
