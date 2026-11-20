-- USER DB-owner SQL Editor, before new message source. No key/config changes.
-- Source LF SHA256 8447da0aa123d8cd158459f999ab2406496d398e13c1aeb2d7ad96026e2d9d09
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-messages-upgrade'));
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>23
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017'))
 or to_regnamespace('adme_messaging') is not null
 or exists(select 1 from information_schema.columns where table_schema='public' and table_name='messages' and column_name='idempotency_key') then
 raise exception 'STOP: expected exact reviewed23 baseline; never repeat or bypass'; end if;
end $gate$;
-- D051: backward-compatible message delivery, participant-only cursors and safety controls.

alter table public.messages add column idempotency_key uuid;
create unique index messages_retry_key on public.messages(sender_id,proposal_id,idempotency_key) where idempotency_key is not null;
create index messages_room_cursor on public.messages(proposal_id,created_at desc,id desc);
create schema adme_messaging;
revoke all on schema adme_messaging from public,anon,authenticated,service_role;
grant usage on schema adme_messaging to authenticated;
create table adme_messaging.blocks (
  proposal_id uuid not null references public.proposals(id),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(proposal_id,actor_id)
);
create table adme_messaging.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id),
  reporter_id uuid not null references public.profiles(id),
  reason text not null check(length(btrim(reason)) between 10 and 2000),
  status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(message_id,reporter_id)
);
alter table adme_messaging.blocks enable row level security;
alter table adme_messaging.reports enable row level security;
revoke all on all tables in schema adme_messaging from public,anon,authenticated,service_role;

create function adme_messaging.guard_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.proposals;
begin
  -- SQL owner fixtures/imports retain their privileged path; REST roles never do.
  if auth.uid() is null and session_user='postgres' then return new; end if;
  select * into p from public.proposals where id=new.proposal_id for update;
  if auth.uid() is null or new.sender_id<>auth.uid() or p.id is null
    or auth.uid() not in (p.brand_id,p.creator_user_id) or p.status='rejected'
    or exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id)
    or not exists(select 1 from public.creators c join public.campaigns ca on ca.id=p.campaign_id
      where c.id=p.creator_id and c.moderation_status='allowed' and ca.moderation_status='allowed') then
    raise exception 'message not allowed' using errcode='42501'; end if;
  if new.url is not null and (length(new.url)>1000 or adme_creator.public_https(new.url) is null) then
    raise exception 'invalid message URL' using errcode='22023'; end if;
  if new.kind='deliverable' and (p.creator_user_id<>auth.uid() or p.status not in ('accepted','revision_requested') or new.url is null) then
    raise exception 'deliverable not allowed' using errcode='42501'; end if;
  return new;
end;
$$;
create trigger a_message_guard before insert on public.messages for each row execute function adme_messaging.guard_message();

create function adme_messaging.send(p_proposal uuid,p_key uuid,p_body text,p_kind text,p_url text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposals; prior public.messages; result uuid; body_value text:=btrim(p_body); url_value text:=nullif(p_url,'');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_key is null or body_value is null or length(body_value) not between 1 and 3000
    or p_kind is null or p_kind not in ('message','deliverable') then raise invalid_parameter_value; end if;
  select * into prior from public.messages where proposal_id=p.id and sender_id=auth.uid() and idempotency_key=p_key;
  if found then
    if prior.body is distinct from body_value or prior.kind is distinct from p_kind or prior.url is distinct from url_value then
      raise exception 'idempotency key conflict' using errcode='23505'; end if;
    return prior.id;
  end if;
  insert into public.messages(proposal_id,sender_id,body,kind,url,idempotency_key)
    values(p.id,auth.uid(),body_value,p_kind,url_value,p_key) returning id into result;
  return result;
end;
$$;

create function adme_messaging.page(p_proposal uuid,p_before_at timestamptz,p_before_id uuid,p_limit int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.proposals; result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or (p_before_at is null)<>(p_before_id is null) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('message_read',auth.uid()::text,120,60);
  with rows as (
    select m.* from public.messages m where m.proposal_id=p.id
      and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
    order by m.created_at desc,m.id desc limit p_limit+1
  ), numbered as (select *,row_number() over(order by created_at desc,id desc) n from rows)
  select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'senderId',sender_id,'body',body,'kind',kind,'url',url,'createdAt',created_at)
    order by created_at desc,id desc) filter(where n<=p_limit),'[]'::jsonb),
    'nextCursor',(select jsonb_build_object('createdAt',created_at,'id',id) from numbered where n=p_limit and exists(select 1 from numbered where n>p_limit)),
    'blocked',exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id),
    'blockedByMe',exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id and b.actor_id=auth.uid())) into result from numbered;
  return result;
end;
$$;
create function adme_messaging.block_room(p_proposal uuid,p_blocked boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.proposals;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_blocked is null then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('message_block',auth.uid()::text,30,60);
  if p_blocked then insert into adme_messaging.blocks(proposal_id,actor_id) values(p.id,auth.uid()) on conflict do nothing;
  else delete from adme_messaging.blocks where proposal_id=p.id and actor_id=auth.uid(); end if;
  return p_blocked;
end;
$$;
create function adme_messaging.report_message(p_message uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.messages; p public.proposals; result uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into m from public.messages where id=p_message;
  select * into p from public.proposals where id=m.proposal_id for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) or m.sender_id=auth.uid() then
    raise exception 'report not allowed' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise invalid_parameter_value; end if;
  select id into result from adme_messaging.reports where message_id=m.id and reporter_id=auth.uid();
  if result is not null then return result; end if;
  perform adme_ops.require_quota('message_report_hour',auth.uid()::text,5,3600);
  perform adme_ops.require_quota('message_report_day',auth.uid()::text,10,86400);
  insert into adme_messaging.reports(message_id,reporter_id,reason) values(m.id,auth.uid(),btrim(p_reason)) returning id into result;
  return result;
end;
$$;
create function public.conversation_send(p_proposal uuid,p_key uuid,p_body text,p_kind text,p_url text default null) returns uuid
language sql security invoker set search_path='' as $$ select adme_messaging.send($1,$2,$3,$4,$5); $$;
create function public.conversation_page(p_proposal uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit int default 20) returns jsonb
language sql security invoker set search_path='' as $$ select adme_messaging.page($1,$2,$3,$4); $$;
create function public.conversation_block(p_proposal uuid,p_blocked boolean) returns boolean
language sql security invoker set search_path='' as $$ select adme_messaging.block_room($1,$2); $$;
create function public.conversation_report(p_message uuid,p_reason text) returns uuid
language sql security invoker set search_path='' as $$ select adme_messaging.report_message($1,$2); $$;
revoke all on all functions in schema adme_messaging from public,anon,authenticated,service_role;
grant execute on function adme_messaging.send(uuid,uuid,text,text,text),adme_messaging.page(uuid,timestamptz,uuid,int),adme_messaging.block_room(uuid,boolean),adme_messaging.report_message(uuid,text) to authenticated;
revoke all on function public.conversation_send(uuid,uuid,text,text,text),public.conversation_page(uuid,timestamptz,uuid,int),public.conversation_block(uuid,boolean),public.conversation_report(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.conversation_send(uuid,uuid,text,text,text),public.conversation_page(uuid,timestamptz,uuid,int),public.conversation_block(uuid,boolean),public.conversation_report(uuid,text) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200018','conversations',array[$message_source$-- D051: backward-compatible message delivery, participant-only cursors and safety controls.
begin;
alter table public.messages add column idempotency_key uuid;
create unique index messages_retry_key on public.messages(sender_id,proposal_id,idempotency_key) where idempotency_key is not null;
create index messages_room_cursor on public.messages(proposal_id,created_at desc,id desc);
create schema adme_messaging;
revoke all on schema adme_messaging from public,anon,authenticated,service_role;
grant usage on schema adme_messaging to authenticated;
create table adme_messaging.blocks (
  proposal_id uuid not null references public.proposals(id),
  actor_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  primary key(proposal_id,actor_id)
);
create table adme_messaging.reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id),
  reporter_id uuid not null references public.profiles(id),
  reason text not null check(length(btrim(reason)) between 10 and 2000),
  status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  unique(message_id,reporter_id)
);
alter table adme_messaging.blocks enable row level security;
alter table adme_messaging.reports enable row level security;
revoke all on all tables in schema adme_messaging from public,anon,authenticated,service_role;

create function adme_messaging.guard_message() returns trigger
language plpgsql security definer set search_path='' as $$
declare p public.proposals;
begin
  -- SQL owner fixtures/imports retain their privileged path; REST roles never do.
  if auth.uid() is null and session_user='postgres' then return new; end if;
  select * into p from public.proposals where id=new.proposal_id for update;
  if auth.uid() is null or new.sender_id<>auth.uid() or p.id is null
    or auth.uid() not in (p.brand_id,p.creator_user_id) or p.status='rejected'
    or exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id)
    or not exists(select 1 from public.creators c join public.campaigns ca on ca.id=p.campaign_id
      where c.id=p.creator_id and c.moderation_status='allowed' and ca.moderation_status='allowed') then
    raise exception 'message not allowed' using errcode='42501'; end if;
  if new.url is not null and (length(new.url)>1000 or adme_creator.public_https(new.url) is null) then
    raise exception 'invalid message URL' using errcode='22023'; end if;
  if new.kind='deliverable' and (p.creator_user_id<>auth.uid() or p.status not in ('accepted','revision_requested') or new.url is null) then
    raise exception 'deliverable not allowed' using errcode='42501'; end if;
  return new;
end;
$$;
create trigger a_message_guard before insert on public.messages for each row execute function adme_messaging.guard_message();

create function adme_messaging.send(p_proposal uuid,p_key uuid,p_body text,p_kind text,p_url text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposals; prior public.messages; result uuid; body_value text:=btrim(p_body); url_value text:=nullif(p_url,'');
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_key is null or body_value is null or length(body_value) not between 1 and 3000
    or p_kind is null or p_kind not in ('message','deliverable') then raise invalid_parameter_value; end if;
  select * into prior from public.messages where proposal_id=p.id and sender_id=auth.uid() and idempotency_key=p_key;
  if found then
    if prior.body is distinct from body_value or prior.kind is distinct from p_kind or prior.url is distinct from url_value then
      raise exception 'idempotency key conflict' using errcode='23505'; end if;
    return prior.id;
  end if;
  insert into public.messages(proposal_id,sender_id,body,kind,url,idempotency_key)
    values(p.id,auth.uid(),body_value,p_kind,url_value,p_key) returning id into result;
  return result;
end;
$$;

create function adme_messaging.page(p_proposal uuid,p_before_at timestamptz,p_before_id uuid,p_limit int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.proposals; result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or (p_before_at is null)<>(p_before_id is null) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('message_read',auth.uid()::text,120,60);
  with rows as (
    select m.* from public.messages m where m.proposal_id=p.id
      and (p_before_at is null or (m.created_at,m.id)<(p_before_at,p_before_id))
    order by m.created_at desc,m.id desc limit p_limit+1
  ), numbered as (select *,row_number() over(order by created_at desc,id desc) n from rows)
  select jsonb_build_object('version',1,'items',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'senderId',sender_id,'body',body,'kind',kind,'url',url,'createdAt',created_at)
    order by created_at desc,id desc) filter(where n<=p_limit),'[]'::jsonb),
    'nextCursor',(select jsonb_build_object('createdAt',created_at,'id',id) from numbered where n=p_limit and exists(select 1 from numbered where n>p_limit)),
    'blocked',exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id),
    'blockedByMe',exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id and b.actor_id=auth.uid())) into result from numbered;
  return result;
end;
$$;
create function adme_messaging.block_room(p_proposal uuid,p_blocked boolean) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.proposals;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into p from public.proposals where id=p_proposal for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'message not allowed' using errcode='42501'; end if;
  if p_blocked is null then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('message_block',auth.uid()::text,30,60);
  if p_blocked then insert into adme_messaging.blocks(proposal_id,actor_id) values(p.id,auth.uid()) on conflict do nothing;
  else delete from adme_messaging.blocks where proposal_id=p.id and actor_id=auth.uid(); end if;
  return p_blocked;
end;
$$;
create function adme_messaging.report_message(p_message uuid,p_reason text) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.messages; p public.proposals; result uuid;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  select * into m from public.messages where id=p_message;
  select * into p from public.proposals where id=m.proposal_id for update;
  if p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) or m.sender_id=auth.uid() then
    raise exception 'report not allowed' using errcode='42501'; end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 2000 then raise invalid_parameter_value; end if;
  select id into result from adme_messaging.reports where message_id=m.id and reporter_id=auth.uid();
  if result is not null then return result; end if;
  perform adme_ops.require_quota('message_report_hour',auth.uid()::text,5,3600);
  perform adme_ops.require_quota('message_report_day',auth.uid()::text,10,86400);
  insert into adme_messaging.reports(message_id,reporter_id,reason) values(m.id,auth.uid(),btrim(p_reason)) returning id into result;
  return result;
end;
$$;
create function public.conversation_send(p_proposal uuid,p_key uuid,p_body text,p_kind text,p_url text default null) returns uuid
language sql security invoker set search_path='' as $$ select adme_messaging.send($1,$2,$3,$4,$5); $$;
create function public.conversation_page(p_proposal uuid,p_before_at timestamptz default null,p_before_id uuid default null,p_limit int default 20) returns jsonb
language sql security invoker set search_path='' as $$ select adme_messaging.page($1,$2,$3,$4); $$;
create function public.conversation_block(p_proposal uuid,p_blocked boolean) returns boolean
language sql security invoker set search_path='' as $$ select adme_messaging.block_room($1,$2); $$;
create function public.conversation_report(p_message uuid,p_reason text) returns uuid
language sql security invoker set search_path='' as $$ select adme_messaging.report_message($1,$2); $$;
revoke all on all functions in schema adme_messaging from public,anon,authenticated,service_role;
grant execute on function adme_messaging.send(uuid,uuid,text,text,text),adme_messaging.page(uuid,timestamptz,uuid,int),adme_messaging.block_room(uuid,boolean),adme_messaging.report_message(uuid,text) to authenticated;
revoke all on function public.conversation_send(uuid,uuid,text,text,text),public.conversation_page(uuid,timestamptz,uuid,int),public.conversation_block(uuid,boolean),public.conversation_report(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.conversation_send(uuid,uuid,text,text,text),public.conversation_page(uuid,timestamptz,uuid,int),public.conversation_block(uuid,boolean),public.conversation_report(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
$message_source$]);
commit;

begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-review-workflow'));
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>24
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018'))
 or to_regnamespace('adme_review') is not null or to_regnamespace('adme_messaging') is null then
 raise exception 'STOP: expected exact reviewed24 baseline; agent must inspect'; end if;
end $gate$;
-- D057: evidence is private by default; no scoring or automatic publication.

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

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200019','review_workflow',array[$review_source$-- D057: evidence is private by default; no scoring or automatic publication.
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
$review_source$]);
-- D057: never expose original allegations; a changed response invalidates open reviews.

alter table adme_review.policy add constraint review_policy_approval_required check(not enabled or
  (version is not null and length(version) between 1 and 80 and approval_ref is not null and adme_creator.public_https(approval_ref) is not null));
create function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind') else '{}'::jsonb end;
$$;
revoke all on function adme_review.public_payload(text,jsonb) from public,anon,authenticated,service_role;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or p_kind is distinct from 'issue' then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
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
create or replace function adme_review.respond(p_id uuid,p_expected int,p_body text,p_source text,p_public boolean) returns uuid
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
  if c.status='withdrawn' then raise exception 'review conflict' using errcode='40001'; end if;
  insert into adme_review.revisions(case_id,version,payload,actor_id)
    select c.id,c.version+1,payload,auth.uid() from adme_review.revisions where case_id=c.id and version=c.version;
  insert into adme_review.responses(case_id,version,actor_id,body,source_url,publish_consent)
    values(c.id,c.version+1,auth.uid(),btrim(p_body),p_source,p_public) returning id into result;
  update adme_review.cases set version=c.version+1,status='pending',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:response:'||(c.version+1));
  return result;
end;
$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200020','review_public_boundary',array[$review_source$-- D057: never expose original allegations; a changed response invalidates open reviews.
begin;
alter table adme_review.policy add constraint review_policy_approval_required check(not enabled or
  (version is not null and length(version) between 1 and 80 and approval_ref is not null and adme_creator.public_https(approval_ref) is not null));
create function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind') else '{}'::jsonb end;
$$;
revoke all on function adme_review.public_payload(text,jsonb) from public,anon,authenticated,service_role;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or p_kind is distinct from 'issue' then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
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
create or replace function adme_review.respond(p_id uuid,p_expected int,p_body text,p_source text,p_public boolean) returns uuid
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
  if c.status='withdrawn' then raise exception 'review conflict' using errcode='40001'; end if;
  insert into adme_review.revisions(case_id,version,payload,actor_id)
    select c.id,c.version+1,payload,auth.uid() from adme_review.revisions where case_id=c.id and version=c.version;
  insert into adme_review.responses(case_id,version,actor_id,body,source_url,publish_consent)
    values(c.id,c.version+1,auth.uid(),btrim(p_body),p_source,p_public) returning id into result;
  update adme_review.cases set version=c.version+1,status='pending',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:response:'||(c.version+1));
  return result;
end;
$$;
notify pgrst,'reload schema';
commit;
$review_source$]);
-- D029: owner-submitted advertising evidence uses the same immutable review workflow.

alter table adme_review.policy add column ad_enabled boolean not null default false;
alter table adme_review.policy add column ad_version text;
alter table adme_review.policy add column ad_approval_ref text;
alter table adme_review.policy add constraint review_ad_policy_required check(not ad_enabled or
  (ad_version is not null and length(ad_version) between 1 and 80 and ad_approval_ref is not null and adme_creator.public_https(ad_approval_ref) is not null));
alter table adme_review.cases drop constraint cases_kind_check;
alter table adme_review.cases add constraint cases_kind_check check(kind in ('issue','ad'));
alter table adme_review.decisions drop constraint decisions_classification_check;
alter table adme_review.decisions add constraint decisions_classification_check check(classification in ('unverified_claim','confirmed_fact','official_correction','ad_evidence'));
alter table adme_review.cases add column evidence_url text;
create unique index review_ad_source_unique on adme_review.cases(creator_id,evidence_url) where kind='ad';
create function adme_review.validate_ad(p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare field text; started date; ended date;
begin
 if auth.uid() is null or public.my_role() is distinct from 'creator' or not exists(select 1 from public.creators where id=p_creator and owner_id=auth.uid()) then
   raise exception 'owner submission required' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload-array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl','ownershipConfirmed']<>'{}'::jsonb
   or p_payload->'ownershipConfirmed' is distinct from 'true'::jsonb then raise invalid_parameter_value; end if;
 foreach field in array array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl'] loop
   if jsonb_typeof(p_payload->field) is distinct from 'string' then raise invalid_parameter_value; end if;
 end loop;
 if length(btrim(p_payload->>'brandLabel')) not between 2 and 100
   or length(btrim(p_payload->>'category')) not between 2 and 50 or length(btrim(p_payload->>'format')) not between 2 and 50
   or (p_payload->>'startedOn') !~ '^\d{4}-\d{2}-\d{2}$' or (p_payload->>'endedOn') !~ '^\d{4}-\d{2}-\d{2}$'
   or p_payload->>'interest' not in ('paid','gifted','affiliate','unpaid','unknown')
   or p_payload->>'disclosure' not in ('visible','missing','unclear')
   or p_payload->>'evidenceKind' not in ('self_declaration','paid_partnership_label','official_confirmation','brand_mention')
   or length(p_payload->>'sourceUrl')>1000 or adme_creator.public_https(p_payload->>'sourceUrl') is null then raise invalid_parameter_value; end if;
 begin started:=(p_payload->>'startedOn')::date; ended:=(p_payload->>'endedOn')::date;
 exception when invalid_datetime_format or datetime_field_overflow then raise invalid_parameter_value; end;
 if started>ended or ended>(statement_timestamp() at time zone 'Asia/Seoul')::date then raise invalid_parameter_value; end if;
 return jsonb_build_object('brandLabel',btrim(p_payload->>'brandLabel'),'category',btrim(p_payload->>'category'),'format',btrim(p_payload->>'format'),
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl','ownershipConfirmed',true);
end;
$$;
create function adme_review.ad_source_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update adme_review.cases set evidence_url=new.payload->>'sourceUrl' where id=new.case_id and kind='ad';
 return new;
end;
$$;
create trigger review_ad_source after insert on adme_review.revisions for each row execute function adme_review.ad_source_guard();
revoke all on function adme_review.validate_ad(text,jsonb),adme_review.ad_source_guard() from public,anon,authenticated,service_role;
create or replace function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind')
 when p_kind='ad' then jsonb_build_object('brandLabel',p_payload->'brandLabel','category',p_payload->'category','format',p_payload->'format',
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl') else '{}'::jsonb end;
$$;
create or replace function adme_review.validate_submission(p_kind text,p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.creators; reason text; source text; evidence text;
begin
  select * into c from public.creators where id=p_creator and ((published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin());
  if c.id is null then raise exception 'submission unavailable' using errcode='42501'; end if;
  if p_kind='ad' then return adme_review.validate_ad(p_creator,p_payload); end if;
  if p_kind is distinct from 'issue' or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-array['reason','sourceUrl','evidenceKind']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  reason:=btrim(p_payload->>'reason'); source:=p_payload->>'sourceUrl'; evidence:=p_payload->>'evidenceKind';
  if jsonb_typeof(p_payload->'reason') is distinct from 'string' or reason is null or length(reason) not between 10 and 2000
    or jsonb_typeof(p_payload->'sourceUrl') is distinct from 'string' or length(source)>1000 or adme_creator.public_https(source) is null
    or evidence is null or evidence not in ('claim','source','official_statement','correction') then raise invalid_parameter_value; end if;
  return jsonb_build_object('reason',reason,'sourceUrl',source,'evidenceKind',evidence);
end;
$$;
create or replace function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid; active_enabled boolean; active_version text;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction','ad_evidence')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  if (c.kind='issue' and p_classification='ad_evidence') or (c.kind='ad' and p_classification not in ('unverified_claim','ad_evidence')) then raise invalid_parameter_value; end if;
  if p_publish and c.kind='ad' and (p_classification<>'ad_evidence' or not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb)) then
    raise exception 'advertising evidence required' using errcode='23514'; end if;
  select * into policy from adme_review.policy where singleton for share;
  active_enabled:=case when c.kind='ad' then policy.ad_enabled else policy.enabled end;
  active_version:=case when c.kind='ad' then policy.ad_version else policy.version end;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or active_enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,active_version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version and s.publish_consent order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and (case when c.kind='ad' then p.ad_enabled else p.enabled end)
      and d.policy_version=(case when c.kind='ad' then p.ad_version else p.version end)
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200021','ad_history',array[$review_source$-- D029: owner-submitted advertising evidence uses the same immutable review workflow.
begin;
alter table adme_review.policy add column ad_enabled boolean not null default false;
alter table adme_review.policy add column ad_version text;
alter table adme_review.policy add column ad_approval_ref text;
alter table adme_review.policy add constraint review_ad_policy_required check(not ad_enabled or
  (ad_version is not null and length(ad_version) between 1 and 80 and ad_approval_ref is not null and adme_creator.public_https(ad_approval_ref) is not null));
alter table adme_review.cases drop constraint cases_kind_check;
alter table adme_review.cases add constraint cases_kind_check check(kind in ('issue','ad'));
alter table adme_review.decisions drop constraint decisions_classification_check;
alter table adme_review.decisions add constraint decisions_classification_check check(classification in ('unverified_claim','confirmed_fact','official_correction','ad_evidence'));
alter table adme_review.cases add column evidence_url text;
create unique index review_ad_source_unique on adme_review.cases(creator_id,evidence_url) where kind='ad';
create function adme_review.validate_ad(p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare field text; started date; ended date;
begin
 if auth.uid() is null or public.my_role() is distinct from 'creator' or not exists(select 1 from public.creators where id=p_creator and owner_id=auth.uid()) then
   raise exception 'owner submission required' using errcode='42501'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or p_payload-array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl','ownershipConfirmed']<>'{}'::jsonb
   or p_payload->'ownershipConfirmed' is distinct from 'true'::jsonb then raise invalid_parameter_value; end if;
 foreach field in array array['brandLabel','category','format','startedOn','endedOn','interest','disclosure','evidenceKind','sourceUrl'] loop
   if jsonb_typeof(p_payload->field) is distinct from 'string' then raise invalid_parameter_value; end if;
 end loop;
 if length(btrim(p_payload->>'brandLabel')) not between 2 and 100
   or length(btrim(p_payload->>'category')) not between 2 and 50 or length(btrim(p_payload->>'format')) not between 2 and 50
   or (p_payload->>'startedOn') !~ '^\d{4}-\d{2}-\d{2}$' or (p_payload->>'endedOn') !~ '^\d{4}-\d{2}-\d{2}$'
   or p_payload->>'interest' not in ('paid','gifted','affiliate','unpaid','unknown')
   or p_payload->>'disclosure' not in ('visible','missing','unclear')
   or p_payload->>'evidenceKind' not in ('self_declaration','paid_partnership_label','official_confirmation','brand_mention')
   or length(p_payload->>'sourceUrl')>1000 or adme_creator.public_https(p_payload->>'sourceUrl') is null then raise invalid_parameter_value; end if;
 begin started:=(p_payload->>'startedOn')::date; ended:=(p_payload->>'endedOn')::date;
 exception when invalid_datetime_format or datetime_field_overflow then raise invalid_parameter_value; end;
 if started>ended or ended>(statement_timestamp() at time zone 'Asia/Seoul')::date then raise invalid_parameter_value; end if;
 return jsonb_build_object('brandLabel',btrim(p_payload->>'brandLabel'),'category',btrim(p_payload->>'category'),'format',btrim(p_payload->>'format'),
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl','ownershipConfirmed',true);
end;
$$;
create function adme_review.ad_source_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update adme_review.cases set evidence_url=new.payload->>'sourceUrl' where id=new.case_id and kind='ad';
 return new;
end;
$$;
create trigger review_ad_source after insert on adme_review.revisions for each row execute function adme_review.ad_source_guard();
revoke all on function adme_review.validate_ad(text,jsonb),adme_review.ad_source_guard() from public,anon,authenticated,service_role;
create or replace function adme_review.public_payload(p_kind text,p_payload jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select case when p_kind='issue' then jsonb_build_object('sourceUrl',p_payload->'sourceUrl','evidenceKind',p_payload->'evidenceKind')
 when p_kind='ad' then jsonb_build_object('brandLabel',p_payload->'brandLabel','category',p_payload->'category','format',p_payload->'format',
   'startedOn',p_payload->'startedOn','endedOn',p_payload->'endedOn','interest',p_payload->'interest','disclosure',p_payload->'disclosure',
   'evidenceKind',p_payload->'evidenceKind','sourceUrl',p_payload->'sourceUrl') else '{}'::jsonb end;
$$;
create or replace function adme_review.validate_submission(p_kind text,p_creator text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.creators; reason text; source text; evidence text;
begin
  select * into c from public.creators where id=p_creator and ((published and moderation_status='allowed') or owner_id=auth.uid() or public.is_admin());
  if c.id is null then raise exception 'submission unavailable' using errcode='42501'; end if;
  if p_kind='ad' then return adme_review.validate_ad(p_creator,p_payload); end if;
  if p_kind is distinct from 'issue' or jsonb_typeof(p_payload) is distinct from 'object'
    or p_payload-array['reason','sourceUrl','evidenceKind']<>'{}'::jsonb then raise invalid_parameter_value; end if;
  reason:=btrim(p_payload->>'reason'); source:=p_payload->>'sourceUrl'; evidence:=p_payload->>'evidenceKind';
  if jsonb_typeof(p_payload->'reason') is distinct from 'string' or reason is null or length(reason) not between 10 and 2000
    or jsonb_typeof(p_payload->'sourceUrl') is distinct from 'string' or length(source)>1000 or adme_creator.public_https(source) is null
    or evidence is null or evidence not in ('claim','source','official_statement','correction') then raise invalid_parameter_value; end if;
  return jsonb_build_object('reason',reason,'sourceUrl',source,'evidenceKind',evidence);
end;
$$;
create or replace function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid; active_enabled boolean; active_version text;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction','ad_evidence')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  if (c.kind='issue' and p_classification='ad_evidence') or (c.kind='ad' and p_classification not in ('unverified_claim','ad_evidence')) then raise invalid_parameter_value; end if;
  if p_publish and c.kind='ad' and (p_classification<>'ad_evidence' or not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb)) then
    raise exception 'advertising evidence required' using errcode='23514'; end if;
  select * into policy from adme_review.policy where singleton for share;
  active_enabled:=case when c.kind='ad' then policy.ad_enabled else policy.enabled end;
  active_version:=case when c.kind='ad' then policy.ad_version else policy.version end;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or active_enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,active_version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version and s.publish_consent order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and (case when c.kind='ad' then p.ad_enabled else p.enabled end)
      and d.policy_version=(case when c.kind='ad' then p.ad_version else p.version end)
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
notify pgrst,'reload schema';
commit;
$review_source$]);
-- D057: repeated withdrawal is an idempotent no-op, not unbounded audit storage.

create or replace function adme_review.withdraw(p_id uuid,p_expected int) returns boolean
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or (c.submitter_id<>auth.uid() and not public.is_admin()) then raise exception 'withdrawal not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  if c.status='withdrawn' then return true; end if;
  perform adme_ops.require_quota('review_withdraw',auth.uid()::text,30,60);
  update adme_review.cases set status='withdrawn',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:withdraw:'||c.version);
  return true;
end;
$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200022','review_withdraw_quota',array[$review_source$-- D057: repeated withdrawal is an idempotent no-op, not unbounded audit storage.
begin;
create or replace function adme_review.withdraw(p_id uuid,p_expected int) returns boolean
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases;
begin
  select * into c from adme_review.cases where id=p_id for update;
  if auth.uid() is null or c.id is null or (c.submitter_id<>auth.uid() and not public.is_admin()) then raise exception 'withdrawal not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected then raise exception 'revision conflict' using errcode='40001'; end if;
  if c.status='withdrawn' then return true; end if;
  perform adme_ops.require_quota('review_withdraw',auth.uid()::text,30,60);
  update adme_review.cases set status='withdrawn',public_visible=false,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:withdraw:'||c.version);
  return true;
end;
$$;
notify pgrst,'reload schema';
commit;
$review_source$]);
-- D029: weak evidence is never classified as confirmed advertising, even privately.

create or replace function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid; active_enabled boolean; active_version text;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction','ad_evidence')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  if (c.kind='issue' and p_classification='ad_evidence') or (c.kind='ad' and p_classification not in ('unverified_claim','ad_evidence')) then raise invalid_parameter_value; end if;
  if c.kind='ad' and ((p_publish and p_classification<>'ad_evidence') or (p_classification='ad_evidence' and not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb))) then
    raise exception 'advertising evidence required' using errcode='23514'; end if;
  select * into policy from adme_review.policy where singleton for share;
  active_enabled:=case when c.kind='ad' then policy.ad_enabled else policy.enabled end;
  active_version:=case when c.kind='ad' then policy.ad_version else policy.version end;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or active_enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,active_version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200023','ad_evidence_gate',array[$review_source$-- D029: weak evidence is never classified as confirmed advertising, even privately.
begin;
create or replace function adme_review.decide(p_id uuid,p_expected int,p_verdict text,p_classification text,p_note text,p_summary text,p_publish boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare c adme_review.cases; policy adme_review.policy; result uuid; active_enabled boolean; active_version text;
begin
  if not public.is_admin() then raise exception 'approved recent MFA required' using errcode='42501'; end if;
  select * into c from adme_review.cases where id=p_id for update;
  if c.id is null then raise exception 'review not allowed' using errcode='42501'; end if;
  if p_expected is null or c.version<>p_expected or c.status<>'pending' then raise exception 'review conflict' using errcode='40001'; end if;
  if c.submitter_id=auth.uid() then raise exception 'self review not allowed' using errcode='42501'; end if;
  if p_verdict is null or p_verdict not in ('approved','rejected') or p_classification is null
    or p_classification not in ('unverified_claim','confirmed_fact','official_correction','ad_evidence')
    or p_note is null or length(btrim(p_note)) not between 10 and 2000 or p_summary is null or length(p_summary)>1000 or p_publish is null then raise invalid_parameter_value; end if;
  if (c.kind='issue' and p_classification='ad_evidence') or (c.kind='ad' and p_classification not in ('unverified_claim','ad_evidence')) then raise invalid_parameter_value; end if;
  if c.kind='ad' and ((p_publish and p_classification<>'ad_evidence') or (p_classification='ad_evidence' and not exists(
    select 1 from adme_review.revisions r where r.case_id=c.id and r.version=c.version
      and r.payload->>'evidenceKind' in ('paid_partnership_label','official_confirmation')
      and r.payload->>'interest'<>'unknown' and r.payload->'ownershipConfirmed'='true'::jsonb))) then
    raise exception 'advertising evidence required' using errcode='23514'; end if;
  select * into policy from adme_review.policy where singleton for share;
  active_enabled:=case when c.kind='ad' then policy.ad_enabled else policy.enabled end;
  active_version:=case when c.kind='ad' then policy.ad_version else policy.version end;
  if p_publish and (p_verdict<>'approved' or p_classification='unverified_claim' or length(btrim(p_summary))<10 or active_enabled is distinct from true) then
    raise exception 'publication unavailable' using errcode='23514'; end if;
  insert into adme_review.decisions(case_id,version,reviewer_id,verdict,classification,note,public_summary,publish,policy_version)
    values(c.id,c.version,auth.uid(),p_verdict,p_classification,btrim(p_note),btrim(p_summary),p_publish,active_version) returning id into result;
  update adme_review.cases set status=p_verdict,public_visible=p_publish,updated_at=statement_timestamp() where id=c.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),c.id::text,'review:'||p_verdict||':'||c.version);
  return result;
end;
$$;
notify pgrst,'reload schema';
commit;
$review_source$]);
-- D057: the latest private position must not resurrect an older public statement.

create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select case when s.publish_consent then jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) else null end from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and (case when c.kind='ad' then p.ad_enabled else p.enabled end)
      and d.policy_version=(case when c.kind='ad' then p.ad_version else p.version end)
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200024','latest_response_consent',array[$review_source$-- D057: the latest private position must not resurrect an older public statement.
begin;
create or replace function adme_review.public_records(p_creator text,p_kind text) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if p_creator is null or length(p_creator) not between 1 and 100 or (p_kind is null or p_kind not in ('issue','ad')) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('review_public',coalesce(auth.uid()::text,'anonymous-shared'),300,60);
  return coalesce((select jsonb_agg(x.dto order by x.reviewed_at desc,x.id desc) from (
    select c.id,d.reviewed_at,jsonb_build_object('id',c.id,'version',c.version,'kind',c.kind,'isDemo',c.is_demo,'payload',adme_review.public_payload(c.kind,r.payload),
      'classification',d.classification,'summary',d.public_summary,'reviewedAt',d.reviewed_at,'policyVersion',d.policy_version,
      'response',(select case when s.publish_consent then jsonb_build_object('body',s.body,'sourceUrl',s.source_url,'createdAt',s.created_at) else null end from adme_review.responses s
        where s.case_id=c.id and s.version<=c.version order by s.created_at desc,s.id desc limit 1)) dto
    from adme_review.cases c join adme_review.revisions r on r.case_id=c.id and r.version=c.version
    join adme_review.decisions d on d.case_id=c.id and d.version=c.version
    join public.creators cr on cr.id=c.creator_id join adme_review.policy p on p.singleton
    where c.creator_id=p_creator and c.kind=p_kind and c.status='approved' and c.public_visible and d.publish
      and d.classification<>'unverified_claim' and (case when c.kind='ad' then p.ad_enabled else p.enabled end)
      and d.policy_version=(case when c.kind='ad' then p.ad_version else p.version end)
      and cr.published and cr.moderation_status='allowed' order by d.reviewed_at desc,c.id desc limit 50
  ) x),'[]'::jsonb);
end;
$$;
notify pgrst,'reload schema';
commit;
$review_source$]);
commit;
