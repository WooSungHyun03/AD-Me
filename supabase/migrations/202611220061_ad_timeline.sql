-- D030: latest reviewed advertisements; rivals are private per brand account.
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
