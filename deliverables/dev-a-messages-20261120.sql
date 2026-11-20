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
