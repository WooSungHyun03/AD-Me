-- PR-001: additive owned-product condition proposals over the existing budgeted queue.
begin;
create schema adme_product_conditions;
revoke all on schema adme_product_conditions from public,anon,authenticated,service_role;
grant usage on schema adme_product_conditions to authenticated;
create table adme_product_conditions.controls(
 singleton boolean primary key default true check(singleton),enabled boolean not null default false,
 policy_ref text,retention_seconds int,
 check(not enabled or(policy_ref is not null and retention_seconds is not null and length(btrim(policy_ref)) between 8 and 200 and retention_seconds between 60 and 1209600))
);
insert into adme_product_conditions.controls(singleton)values(true);
create table adme_product_conditions.requests(
 id uuid primary key references adme_ops.jobs(id)on delete cascade,
 owner_id uuid not null references public.profiles(id)on delete cascade,
 product_id uuid not null references public.brand_products(id)on delete cascade,
 request_key uuid not null,source jsonb not null,source_version text not null,
 product_version text not null,policy_ref text not null,
 created_at timestamptz not null default now(),expires_at timestamptz not null,
 job_deadline timestamptz not null default(now()+interval '15 minutes'),
 decision text not null default 'pending'check(decision in('pending','confirmed','dismissed')),
 revision int not null default 0 check(revision in(0,1)),selected jsonb not null default '[]',
 decision_key uuid,decision_hash text,
 unique(owner_id,request_key),check(expires_at>created_at),
 check(jsonb_typeof(source)='object'and jsonb_typeof(selected)='array'and jsonb_array_length(selected)<=8)
);
create index product_conditions_owner_history on adme_product_conditions.requests(owner_id,product_id,created_at desc,id desc);
alter table adme_product_conditions.controls enable row level security;
alter table adme_product_conditions.requests enable row level security;
revoke all on all tables in schema adme_product_conditions from public,anon,authenticated,service_role;

create function adme_product_conditions.minimize(p text)returns text language sql immutable set search_path=''as $$
 select regexp_replace(regexp_replace(regexp_replace(btrim(p),'[\w.+-]+@[\w-]+\.[\w.-]+','[이메일]','g'),'(\+?82[-\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}','[전화번호]','g'),'https?://\S+','[링크]','g');
$$;
create function adme_product_conditions.product_version(p public.brand_products)returns text language sql immutable set search_path=''as $$
 select encode(sha256(convert_to(jsonb_build_array(p.name,p.description)::text,'UTF8')),'hex');
$$;
create function adme_product_conditions.current_source(p adme_product_conditions.requests)returns boolean language sql stable security definer set search_path=''as $$
 select exists(select 1 from public.brand_products b join public.profiles a on a.id=b.owner_id
 where b.id=p.product_id and b.owner_id=p.owner_id and a.role='brand'and adme_privacy.actor_active(a.id)
 and adme_product_conditions.product_version(b)=p.product_version)
 and p.expires_at>now()and exists(select 1 from adme_product_conditions.controls c where c.enabled and c.policy_ref=p.policy_ref);
$$;
create function adme_product_conditions.sweep()returns void language plpgsql security definer set search_path=''as $$
begin
 -- Policy-bound physical removal includes the source snapshot and result via job FK.
 delete from adme_ops.jobs j using adme_product_conditions.requests r where j.id=r.id and r.expires_at<=now();
 update adme_ops.jobs j set status='failed',output=null,lease=null,lease_until=null,finished_at=now(),error_code='PRODUCT_SOURCE_UNAVAILABLE'
 where j.kind='marketing_draft'and j.input like 'product-condition-v1:%'and j.status in('queued','running')and
 (not exists(select 1 from adme_product_conditions.requests r where r.id=j.id and adme_product_conditions.current_source(r)and r.job_deadline>now()));
end;$$;

create function adme_product_conditions.valid_result(p jsonb,r adme_product_conditions.requests)returns boolean language plpgsql immutable set search_path=''as $$
declare item jsonb;allowed text[];seen text[]:=array[]::text[];n text;
begin
 if p is null or jsonb_typeof(p)<>'object'or octet_length(p::text)>16000 then return false;end if;
 if exists(select 1 from jsonb_object_keys(p)k where k<>all(array['sourceVersion','sourceContract','modelSourceVersion','promptVersion','runtimeVersion','model','usage','requiresConfirmation','applied','omitted','suggestions']))then return false;end if;
 if p->>'sourceVersion'is distinct from r.source_version or p->>'sourceContract'is distinct from 'owned-product-v1'
 or jsonb_typeof(p->'modelSourceVersion')is distinct from 'string'or p->>'modelSourceVersion'!~'^[a-f0-9]{64}$'
 or p->>'promptVersion'is distinct from 'product-conditions-v2'or p->>'runtimeVersion'is distinct from 'ollama-qwen3-local-v2'
 or p->>'model'is distinct from 'qwen3:1.7b-q4_K_M'or p->'requiresConfirmation'is distinct from 'true'::jsonb or p->'applied'is distinct from 'false'::jsonb then return false;end if;
 if jsonb_typeof(p->'suggestions')is distinct from 'array'or jsonb_array_length(p->'suggestions')>8 then return false;end if;
 if jsonb_typeof(p->'usage')is distinct from 'object'or(select count(*)from jsonb_object_keys(p->'usage'))<>3 then return false;end if;
 foreach n in array array['inputTokens','outputTokens','durationNs']loop
 if jsonb_typeof(p#>array['usage',n])is distinct from 'number'or(p#>>array['usage',n])!~'^[0-9]+$'then return false;end if;
 end loop;
 if(p#>>'{usage,inputTokens}')::numeric>4096 or(p#>>'{usage,outputTokens}')::numeric>650 or(p#>>'{usage,durationNs}')::numeric>180000000000
 or jsonb_typeof(p->'omitted')is distinct from 'number'or(p->>'omitted')!~'^[0-8]$'then return false;end if;
 for item in select value from jsonb_array_elements(p->'suggestions')loop
 if jsonb_typeof(item)<>'object'or(select count(*)from jsonb_object_keys(item))<>4
 or exists(select 1 from jsonb_object_keys(item)k where k<>all(array['kind','value','field','quote']))then return false;end if;
 allowed:=case item->>'kind'when 'category'then array['뷰티·패션','음식','테크·게임','건강·운동','라이프스타일','엔터테인먼트']
 when 'vibe'then array['자연스러움','전문적','친근함','차분함']when 'format'then array['숏폼','제품 리뷰','브이로그','언박싱','튜토리얼','PPL']end;
 if allowed is null or jsonb_typeof(item->'value')is distinct from 'string'or not(item->>'value'=any(allowed))
 or jsonb_typeof(item->'field')is distinct from 'string'or item->>'field'not in('name','description','audience')
 or jsonb_typeof(item->'quote')is distinct from 'string'or length(item->>'quote')not between 2 and 120 then return false;end if;
 if strpos(r.source->>(item->>'field'),item->>'quote')=0 or strpos(item->>'quote',item->>'value')=0 then return false;end if;
 n:=(item->>'kind')||':'||(item->>'value');if n=any(seen)then return false;end if;seen:=array_append(seen,n);
 end loop;return true;
exception when others then return false;
end;$$;

create function adme_product_conditions.create_request(p_product uuid,p_audience text,p_key uuid)returns uuid language plpgsql security definer set search_path=''as $$
declare b public.brand_products;r adme_product_conditions.requests;c adme_product_conditions.controls;v_source jsonb;v_id uuid;audience text;
begin
 perform adme_privacy.enforce_actor();
 if auth.uid()is null or public.my_role()is distinct from 'brand'then raise insufficient_privilege;end if;
 if p_key is null or p_product is null or p_audience is null or length(btrim(p_audience))not between 2 and 160 then raise invalid_parameter_value;end if;
 select * into b from public.brand_products where id=p_product and owner_id=auth.uid()for share;
 if not found then raise sqlstate 'PT404'using message='product unavailable';end if;
 audience:=adme_product_conditions.minimize(p_audience);
 perform pg_advisory_xact_lock(hashtextextended('product-conditions:'||auth.uid()::text||p_key::text,0));
 select * into r from adme_product_conditions.requests where owner_id=auth.uid()and request_key=p_key;
 if found then
 if r.product_id<>p_product or r.source->>'audience'<>audience then raise unique_violation;end if;
 return r.id;end if;
 select * into c from adme_product_conditions.controls where singleton for share;
 if not c.enabled then raise sqlstate 'PT404'using message='product conditions disabled';end if;
 perform adme_product_conditions.sweep();
 v_source:=jsonb_build_object('name',adme_product_conditions.minimize(b.name),'description',adme_product_conditions.minimize(b.description),'audience',audience);
 v_id:=public.ops_draft_create('product-condition-v1:'||p_key::text);
 insert into adme_product_conditions.requests(id,owner_id,product_id,request_key,source,source_version,product_version,policy_ref,expires_at)
 values(v_id,auth.uid(),p_product,p_key,v_source,encode(sha256(convert_to(v_source::text,'UTF8')),'hex'),adme_product_conditions.product_version(b),c.policy_ref,now()+make_interval(secs=>c.retention_seconds));
 return v_id;
end;$$;

create function adme_product_conditions.page(p_id uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare r adme_product_conditions.requests;j adme_ops.jobs;v_current boolean;state text;result jsonb;
begin
 perform adme_privacy.enforce_actor();
 if auth.uid()is null or public.my_role()is distinct from 'brand'then raise insufficient_privilege;end if;
 select * into r from adme_product_conditions.requests where id=p_id and owner_id=auth.uid();
 if not found then raise sqlstate 'PT404'using message='request unavailable';end if;
 perform adme_ops.require_quota('product_conditions_read',auth.uid()::text,120,60);
 perform adme_product_conditions.sweep();
 if r.expires_at<=now()then raise sqlstate 'PT404'using message='request unavailable';end if;
 select * into j from adme_ops.jobs where id=r.id;
 v_current:=adme_product_conditions.current_source(r);
 state:=case when not(select enabled from adme_product_conditions.controls)then 'disabled'when not v_current then 'stale'
 when j.status in('queued','running')and r.job_deadline<=now()then 'failed'else j.status end;
 result:=case when state='done'and adme_product_conditions.valid_result(j.output,r)then j.output end;
 if state='done'and result is null then state:='failed';end if;
 return jsonb_build_object('id',r.id,'productId',r.product_id,'sourceVersion',r.source_version,'source',r.source,'expiresAt',r.expires_at,
 'status',state,'decision',r.decision,'revision',r.revision,'selected',r.selected,'output',result);
end;$$;
create function adme_product_conditions.latest(p_product uuid)returns jsonb language plpgsql security definer set search_path=''as $$
declare v_id uuid;
begin
 perform adme_privacy.enforce_actor();
 if auth.uid()is null or public.my_role()is distinct from 'brand'then raise insufficient_privilege;end if;
 if not exists(select 1 from public.brand_products where id=p_product and owner_id=auth.uid())then raise sqlstate 'PT404';end if;
 perform adme_ops.require_quota('product_conditions_latest',auth.uid()::text,120,60);
 select id into v_id from adme_product_conditions.requests where product_id=p_product and owner_id=auth.uid()and expires_at>now()order by created_at desc,id desc limit 1;
 if v_id is null then return null;end if;return adme_product_conditions.page(v_id);
end;$$;
create function adme_product_conditions.decide(p_id uuid,p_key uuid,p_revision int,p_action text,p_selected int[])returns jsonb language plpgsql security definer set search_path=''as $$
declare r adme_product_conditions.requests;j adme_ops.jobs;fingerprint text;v_selected jsonb;
begin
 perform adme_privacy.enforce_actor();
 if auth.uid()is null or public.my_role()is distinct from 'brand'then raise insufficient_privilege;end if;
 if p_key is null or p_revision is null or p_action is null or p_action not in('confirm','dismiss')or p_selected is null
 or cardinality(p_selected)>8 or exists(select 1 from unnest(p_selected)v where v is null or v not between 0 and 7)
 or cardinality(p_selected)<>(select count(distinct v)from unnest(p_selected)v)
 or(p_action='confirm'and cardinality(p_selected)=0)or(p_action='dismiss'and cardinality(p_selected)>0)then raise invalid_parameter_value;end if;
 select * into r from adme_product_conditions.requests where id=p_id and owner_id=auth.uid()for update;
 if not found or r.expires_at<=now()then raise sqlstate 'PT404';end if;
 fingerprint:=md5(jsonb_build_array(p_action,p_revision,(select coalesce(jsonb_agg(v order by v),'[]')from unnest(p_selected)v))::text);
 if r.decision_key=p_key then
 if r.decision_hash<>fingerprint then raise unique_violation;end if;return adme_product_conditions.page(r.id);end if;
 if r.decision<>'pending'or r.revision<>p_revision then raise unique_violation;end if;
 if p_action='confirm'then
 if not adme_product_conditions.current_source(r)then raise unique_violation;end if;
 select * into j from adme_ops.jobs where id=r.id for share;
 if j.status<>'done'or not adme_product_conditions.valid_result(j.output,r)then raise unique_violation;end if;
 if exists(select 1 from unnest(p_selected)v where v>=jsonb_array_length(j.output->'suggestions'))then raise invalid_parameter_value;end if;
 select coalesce(jsonb_agg(value order by ordinality),'[]')into v_selected from jsonb_array_elements(j.output->'suggestions')with ordinality where(ordinality-1)=any(p_selected);
 if exists(select 1 from jsonb_array_elements(v_selected)v where v->>'kind'in('category','format')group by v->>'kind'having count(*)>1)then raise invalid_parameter_value;end if;
 else v_selected:='[]';end if;
 perform adme_ops.require_quota('product_conditions_decide',auth.uid()::text,60,60);
 update adme_product_conditions.requests set decision=case p_action when 'confirm'then 'confirmed'else 'dismissed'end,revision=1,selected=v_selected,decision_key=p_key,decision_hash=fingerprint where id=r.id;
 return adme_product_conditions.page(r.id);
end;$$;

-- Keep all reviewed legacy YouTube quota/checkpoint/reference logic intact.
do $$begin
 execute replace(pg_get_functiondef('adme_ops.ops_worker_claim(text)'::regprocedure),'FUNCTION adme_ops.ops_worker_claim(','FUNCTION adme_ops.ops_worker_claim_before_product(');
 execute replace(pg_get_functiondef('adme_ops.ops_worker_finish(text,uuid,uuid,jsonb,text,integer)'::regprocedure),'FUNCTION adme_ops.ops_worker_finish(','FUNCTION adme_ops.ops_worker_finish_before_product(');
 execute replace(pg_get_functiondef('adme_ops.worker_heartbeat(text,uuid,uuid)'::regprocedure),'FUNCTION adme_ops.worker_heartbeat(','FUNCTION adme_ops.worker_heartbeat_before_product(');
end;$$;
create or replace function adme_ops.ops_worker_claim(p_token text)returns jsonb language plpgsql security definer set search_path=''as $$
declare result jsonb;r adme_product_conditions.requests;
begin
 perform adme_ops.verify_worker(p_token);perform adme_product_conditions.sweep();
 result:=adme_ops.ops_worker_claim_before_product(p_token);if result is null then return null;end if;
 if result->>'kind'='marketing_draft'and result->>'input'like 'product-condition-v1:%'then
 select * into r from adme_product_conditions.requests where id=(result->>'id')::uuid;
 if not found or not adme_product_conditions.current_source(r)or r.job_deadline<=now()then return null;end if;
 return result||jsonb_build_object('operation','product_conditions_v1','productSource',r.source,'productSourceVersion',r.source_version);
 end if;return result;
end;$$;
create or replace function adme_ops.worker_heartbeat(p_token text,p_id uuid,p_lease uuid)returns boolean language plpgsql security definer set search_path=''as $$
declare r adme_product_conditions.requests;marker boolean;
begin
 perform adme_ops.verify_worker(p_token);
 select kind='marketing_draft'and input like 'product-condition-v1:%'into marker from adme_ops.jobs where id=p_id;
 select * into r from adme_product_conditions.requests where id=p_id;
 if marker and(r.id is null or not adme_product_conditions.current_source(r)or r.job_deadline<=now())then return false;end if;
 return adme_ops.worker_heartbeat_before_product(p_token,p_id,p_lease);
end;$$;
create or replace function adme_ops.ops_worker_finish(p_token text,p_id uuid,p_lease uuid,p_result jsonb,p_error text,p_elapsed int)returns boolean language plpgsql security definer set search_path=''as $$
declare r adme_product_conditions.requests;j adme_ops.jobs;err text:=p_error;
begin
 perform adme_ops.verify_worker(p_token);
 select * into j from adme_ops.jobs where id=p_id and status='running'and lease=p_lease and lease_until>now()for update;
 if not found then return false;end if;
 select * into r from adme_product_conditions.requests where id=p_id;
 if j.kind='marketing_draft'and j.input like 'product-condition-v1:%'then
 if r.id is null or not adme_product_conditions.current_source(r)or r.job_deadline<=now()then
 update adme_ops.jobs set status='failed',output=null,error_code='PRODUCT_SOURCE_UNAVAILABLE',lease=null,lease_until=null,finished_at=now()where id=p_id;return false;end if;
 if p_error is null and not adme_product_conditions.valid_result(p_result,r)then err:='PRODUCT_INVALID_OUTPUT';end if;
 end if;
 return adme_ops.ops_worker_finish_before_product(p_token,p_id,p_lease,case when err is null then p_result end,err,p_elapsed);
end;$$;
create function public.product_conditions_create(p_product uuid,p_audience text,p_key uuid)returns uuid language sql security invoker set search_path=''as $$select adme_product_conditions.create_request($1,$2,$3);$$;
create function public.product_conditions_get(p_id uuid)returns jsonb language sql security invoker set search_path=''as $$select adme_product_conditions.page($1);$$;
create function public.product_conditions_latest(p_product uuid)returns jsonb language sql security invoker set search_path=''as $$select adme_product_conditions.latest($1);$$;
create function public.product_conditions_decide(p_id uuid,p_key uuid,p_revision int,p_action text,p_selected int[])returns jsonb language sql security invoker set search_path=''as $$select adme_product_conditions.decide($1,$2,$3,$4,$5);$$;
revoke all on all functions in schema adme_product_conditions from public,anon,authenticated,service_role;
revoke all on function adme_ops.ops_worker_claim_before_product(text),adme_ops.ops_worker_finish_before_product(text,uuid,uuid,jsonb,text,int),adme_ops.worker_heartbeat_before_product(text,uuid,uuid)from public,anon,authenticated,service_role;
revoke all on function public.product_conditions_create(uuid,text,uuid),public.product_conditions_get(uuid),public.product_conditions_latest(uuid),public.product_conditions_decide(uuid,uuid,int,text,int[])from public,anon,authenticated,service_role;
grant execute on function adme_product_conditions.create_request(uuid,text,uuid),adme_product_conditions.page(uuid),adme_product_conditions.latest(uuid),adme_product_conditions.decide(uuid,uuid,int,text,int[]),public.product_conditions_create(uuid,text,uuid),public.product_conditions_get(uuid),public.product_conditions_latest(uuid),public.product_conditions_decide(uuid,uuid,int,text,int[])to authenticated;
select cron.schedule('adme-product-conditions-cleanup','* * * * *','select adme_product_conditions.sweep()');
notify pgrst,'reload schema';
commit;
