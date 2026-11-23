-- D060: scoped support search, no raw JSON/secrets; append-only purpose/action audit.
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
