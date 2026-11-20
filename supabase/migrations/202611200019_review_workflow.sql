-- D057: evidence is private by default; no scoring or automatic publication.
begin;
create schema adme_review;
revoke all on schema adme_review from public,anon,authenticated,service_role;
grant usage on schema adme_review to anon,authenticated;
create table adme_review.policy (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  version text,
  approval_ref text,
  check(not enabled or (length(version) between 1 and 80 and approval_ref like 'https://%'))
);
insert into adme_review.policy default values;
create table adme_review.cases (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('issue')),
  creator_id text not null references public.creators(id),
  submitter_id uuid not null references public.profiles(id),
  request_key uuid not null,
  initial_payload jsonb not null,
  version int not null default 1 check(version>0),
  status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
  public_visible boolean not null default false,
  is_demo boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(submitter_id,request_key)
);
create table adme_review.revisions (
  case_id uuid not null references adme_review.cases(id),
  version int not null check(version>0),
  payload jsonb not null,
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(case_id,version)
);
create table adme_review.responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references adme_review.cases(id),
  version int not null,
  actor_id uuid not null references public.profiles(id),
  body text not null check(length(btrim(body)) between 10 and 2000),
  source_url text,
  publish_consent boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key(case_id,version) references adme_review.revisions(case_id,version)
);
create table adme_review.decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references adme_review.cases(id),
  version int not null,
  reviewer_id uuid not null references public.profiles(id),
  verdict text not null check(verdict in ('approved','rejected')),
  classification text not null check(classification in ('unverified_claim','confirmed_fact','official_correction')),
  note text not null check(length(btrim(note)) between 10 and 2000),
  public_summary text not null default '' check(length(public_summary)<=1000),
  publish boolean not null default false,
  policy_version text,
  reviewed_at timestamptz not null default now(),
  unique(case_id,version),
  foreign key(case_id,version) references adme_review.revisions(case_id,version)
);
create index review_inbox on adme_review.cases(updated_at desc,id desc);
create index review_creator on adme_review.cases(creator_id,kind,status,public_visible);
create index review_response_version on adme_review.responses(case_id,version,created_at desc,id desc);
alter table adme_review.policy enable row level security;
alter table adme_review.cases enable row level security;
alter table adme_review.revisions enable row level security;
alter table adme_review.responses enable row level security;
alter table adme_review.decisions enable row level security;
revoke all on all tables in schema adme_review from public,anon,authenticated,service_role;

create function adme_review.immutable_record() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'review history is immutable' using errcode='23514'; end;
$$;
create trigger review_revision_immutable before update or delete on adme_review.revisions for each row execute function adme_review.immutable_record();
create trigger review_decision_immutable before update or delete on adme_review.decisions for each row execute function adme_review.immutable_record();
create trigger review_response_immutable before update or delete on adme_review.responses for each row execute function adme_review.immutable_record();

create function adme_review.validate_submission(p_kind text,p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.creators; reason text; source text; evidence text;
begin
  select * into c from public.creators where id=p_creator and ((published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin());
  if c.id is null then raise exception 'submission unavailable' using errcode='42501'; end if;
  if p_kind is distinct from 'issue' or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-array['reason','sourceUrl','evidenceKind']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  reason:=btrim(p_payload->>'reason'); source:=p_payload->>'sourceUrl'; evidence:=p_payload->>'evidenceKind';
  if jsonb_typeof(p_payload->'reason') is distinct from 'string' or reason is null or length(reason) not between 10 and 2000
    or jsonb_typeof(p_payload->'sourceUrl') is distinct from 'string' or length(source)>1000 or adme_creator.public_https(source) is null
    or evidence is null or evidence not in ('claim','source','official_statement','correction') then raise invalid_parameter_value; end if;
  return jsonb_build_object('reason',reason,'sourceUrl',source,'evidenceKind',evidence);
end;
$$;
create function adme_review.submit(p_kind text,p_creator text,p_key uuid,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare payload jsonb; prior adme_review.cases; result uuid; demo boolean;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_key is null then raise invalid_parameter_value; end if;
  payload:=adme_review.validate_submission(p_kind,p_creator,p_payload);
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text),hashtext(p_key::text));
  select * into prior from adme_review.cases where submitter_id=auth.uid() and request_key=p_key;
  if found then
    if prior.kind is distinct from p_kind or prior.creator_id is distinct from p_creator or prior.initial_payload is distinct from payload then
      raise exception 'request key conflict' using errcode='23505'; end if;
    return prior.id;
  end if;
  perform adme_ops.require_quota('review_submit_hour',auth.uid()::text,5,3600);
  perform adme_ops.require_quota('review_submit_day',auth.uid()::text,10,86400);
  select coalesce(profile->'is_demo'='true'::jsonb,true) into demo from public.creators where id=p_creator;
  insert into adme_review.cases(kind,creator_id,submitter_id,request_key,initial_payload,is_demo)
    values(p_kind,p_creator,auth.uid(),p_key,payload,demo) returning id into result;
  insert into adme_review.revisions(case_id,version,payload,actor_id) values(result,1,payload,auth.uid());
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),result::text,'review:submit:1');
  return result;
end;
$$;
create function adme_review.revise(p_id uuid,p_expected int,p_payload jsonb) returns int
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; payload jsonb;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or c.submitter_id<>auth.uid() then raise exception 'revision not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  payload:=adme_review.validate_submission(c.kind,c.creator_id,p_payload);
  perform adme_ops.require_quota('review_revise',auth.uid()::text,20,3600);
  insert into adme_review.revisions(case_id,version,payload,actor_id) values(c.id,c.version+1,payload,auth.uid());
  update adme_review.cases set version=c.version+1,status='pending',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:revise:'||(c.version+1));
  return c.version+1;
end;
$$;
create function adme_review.respond(p_id uuid,p_expected int,p_body text,p_source text,p_public boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; result uuid;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or not exists(select 1 from public.creators where id=c.creator_id and owner_id=auth.uid()) then
    raise exception 'response not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  if p_body is null or length(btrim(p_body)) not between 10 and 2000 or p_public is null
    or (p_source is not null and (length(p_source)>1000 or adme_creator.public_https(p_source) is null)) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_response',auth.uid()::text,10,3600);
  insert into adme_review.responses(case_id,version,actor_id,body,source_url,publish_consent)
    values(c.id,c.version,auth.uid(),btrim(p_body),p_source,p_public) returning id into result;
  -- A changed position requires a fresh review; previous decisions remain intact.
  if c.status='approved' then
    insert into adme_review.revisions(case_id,version,payload,actor_id)
      select c.id,c.version+1,payload,auth.uid() from adme_review.revisions where case_id=c.id and version=c.version;
    update adme_review.cases set version=c.version+1,status='pending',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  end if;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:response:'||c.version);
  return result;
end;
$$;
create function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  select * into policy from adme_review.policy where singleton for share;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or policy.enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,policy.version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
create function adme_review.withdraw(p_id uuid,p_expected int) returns boolean
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or (c.submitter_id<>auth.uid() and not public.is_admin()) then raise exception 'withdrawal not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  update adme_review.cases set status='withdrawn',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:withdraw:'||c.version);
  return true;
end;
$$;
create function adme_review.inbox(p_before timestamptz,p_before_id uuid,p_limit int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or (p_before is null)<>(p_before_id is null) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_read',auth.uid()::text,120,60);
  with rows as (
    select c.* from adme_review.cases c join public.creators cr on cr.id=c.creator_id
    where (c.submitter_id=auth.uid() or cr.owner_id=auth.uid() or public.is_admin())
      and (p_before is null or (c.created_at,c.id)<(p_before,p_before_id))
    order by c.created_at desc,c.id desc limit p_limit+1
  ), numbered as (select *,row_number() over(order by created_at desc,id desc) n from rows)
  select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'kind',c.kind,'creatorId',c.creator_id,'version',c.version,'status',c.status,'publicVisible',c.public_visible,'isDemo',c.is_demo,'createdAt',c.created_at,
    'canRevise',c.submitter_id=auth.uid(),'canRespond',exists(select 1 from public.creators cr where cr.id=c.creator_id and cr.owner_id=auth.uid()),
    'canReview',public.is_admin() and c.submitter_id<>auth.uid(),'payload',r.payload,
    'history',(select coalesce(jsonb_agg(jsonb_build_object('version',v.version,'payload',v.payload,'createdAt',v.created_at) order by version),'[]'::jsonb) from adme_review.revisions v where v.case_id=c.id),
    'responses',(select coalesce(jsonb_agg(jsonb_build_object('version',s.version,'body',s.body,'sourceUrl',s.source_url,'publishConsent',s.publish_consent,'createdAt',s.created_at) order by created_at,id),'[]'::jsonb) from adme_review.responses s where s.case_id=c.id),
    'decisions',(select coalesce(jsonb_agg(jsonb_build_object('version',d.version,'classification',d.classification,'verdict',d.verdict,'summary',d.public_summary,
      'note',case when public.is_admin() then d.note else null end,'reviewedAt',d.reviewed_at) order by version),'[]'::jsonb) from adme_review.decisions d where d.case_id=c.id)) order by c.created_at desc,c.id desc) filter(where c.n<=p_limit),'[]'::jsonb),
    'nextCursor',(select jsonb_build_object('createdAt',created_at,'id',id) from numbered where n=p_limit and exists(select 1 from numbered where n>p_limit))) into result
    from numbered c join adme_review.revisions r on r.case_id=c.id and r.version=c.version;
  return result;
end;
$$;
create function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or p_kind is distinct from 'issue' then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',r.payload,
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version and s.publish_consent order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and p.enabled and d.policy_version=p.version
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
create function public.review_submit(p_kind text,p_creator text,p_key uuid,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$ select adme_review.submit($1,$2,$3,$4); $$;
create function public.review_revise(p_id uuid,p_expected int,p_payload jsonb) returns int language sql security invoker set search_path='' as $$ select adme_review.revise($1,$2,$3); $$;
create function public.review_respond(p_id uuid,p_expected int,p_body text,p_source text,p_public boolean) returns uuid language sql security invoker set search_path='' as $$ select adme_review.respond($1,$2,$3,$4,$5); $$;
create function public.review_decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid language sql security invoker set search_path='' as $$ select adme_review.decide($1,$2,$3,$4,$5,$6,$7); $$;
create function public.review_withdraw(p_id uuid,p_expected int) returns boolean language sql security invoker set search_path='' as $$ select adme_review.withdraw($1,$2); $$;
create function public.review_inbox(p_before timestamptz default null,p_before_id uuid default null,p_limit int default 20) returns jsonb language sql security invoker set search_path='' as $$ select adme_review.inbox($1,$2,$3); $$;
create function public.public_review_records(p_creator text,p_kind text default 'issue') returns jsonb language sql security invoker set search_path='' as $$ select adme_review.public_records($1,$2); $$;
revoke all on all functions in schema adme_review from public,anon,authenticated,service_role;
grant execute on function adme_review.submit(text,text,uuid,jsonb),adme_review.revise(uuid,int,jsonb),adme_review.respond(uuid,int,text,text,boolean),adme_review.decide(uuid,int,text,text,text,text,boolean),adme_review.withdraw(uuid,int),adme_review.inbox(timestamptz,uuid,int) to authenticated;
grant execute on function adme_review.public_records(text,text) to anon,authenticated;
revoke all on function public.review_submit(text,text,uuid,jsonb),public.review_revise(uuid,int,jsonb),public.review_respond(uuid,int,text,text,boolean),public.review_decide(uuid,int,text,text,text,text,boolean),public.review_withdraw(uuid,int),public.review_inbox(timestamptz,uuid,int),public.public_review_records(text,text) from public,anon,authenticated,service_role;
grant execute on function public.review_submit(text,text,uuid,jsonb),public.review_revise(uuid,int,jsonb),public.review_respond(uuid,int,text,text,boolean),public.review_decide(uuid,int,text,text,text,text,boolean),public.review_withdraw(uuid,int),public.review_inbox(timestamptz,uuid,int) to authenticated;
grant execute on function public.public_review_records(text,text) to anon,authenticated;
notify pgrst,'reload schema';
commit;
