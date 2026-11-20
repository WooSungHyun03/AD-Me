begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtext('adme-delivery-versions'));
set local search_path=public,pg_catalog;
do $gate$ begin
 if (select count(*) from supabase_migrations.schema_migrations)<>30
 or exists(select 1 from supabase_migrations.schema_migrations where version not in ('202611190001','202611190002','202611190003','202611190004','202611190005','202611190006','202611190007','202611200001','202611200002','202611200003','202611200004','202611200005','202611200006','202611200007','202611200008','202611200010','202611200011','202611200012','202611200013','202611200014','202611200015','202611200016','202611200017','202611200018','202611200019','202611200020','202611200021','202611200022','202611200023','202611200024'))
 or to_regnamespace('adme_delivery') is not null or to_regprocedure('public.delivery_page(uuid,integer,integer)') is not null then
 raise exception 'STOP: expected exact reviewed30 baseline; agent must inspect'; end if;
 if md5(pg_get_functiondef('public.transition_proposal(uuid,text)'::regprocedure)) is distinct from 'd9dec4be6abea4dc06430bc9d442f856'
 or (select pg_get_userbyid(proowner) from pg_proc where oid='public.transition_proposal(uuid,text)'::regprocedure)<>'postgres'
 or not has_function_privilege('authenticated','public.transition_proposal(uuid,text)','execute')
 or has_function_privilege('anon','public.transition_proposal(uuid,text)','execute') then
 raise exception 'STOP: custom/hardened transition contract requires review, never overwrite blindly'; end if;
end $gate$;
set local adme.delivery_staging='on';
-- D054: immutable submission snapshots and actor/version-bound review events.

create schema adme_delivery;
revoke all on schema adme_delivery from public,anon,authenticated,service_role;
grant usage on schema adme_delivery to authenticated;
create table adme_delivery.boundary (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true,
  release_ref text,
  activated_at timestamptz
);
insert into adme_delivery.boundary(singleton,enabled)
values(true,current_setting('adme.delivery_staging',true) is distinct from 'on');
create table adme_delivery.rooms (
  proposal_id uuid primary key references public.proposals(id),
  revision int not null default 0 check(revision>=0),
  submission_count int not null default 0 check(submission_count>=0),
  active_id uuid,
  requested_id uuid,
  managed boolean not null default false
);
create table adme_delivery.submissions (
  id uuid primary key references public.messages(id),
  proposal_id uuid not null references adme_delivery.rooms(proposal_id),
  version int not null check(version>0),
  author_id uuid not null references public.profiles(id),
  body text not null,
  url text,
  legacy boolean not null default false,
  created_at timestamptz not null,
  unique(proposal_id,version)
);
alter table adme_delivery.rooms add constraint delivery_active_fk foreign key(active_id) references adme_delivery.submissions(id);
alter table adme_delivery.rooms add constraint delivery_requested_fk foreign key(requested_id) references adme_delivery.submissions(id);
create table adme_delivery.attestations (
  submission_id uuid primary key references adme_delivery.submissions(id),
  actor_id uuid not null references public.profiles(id),
  declaration text not null check(declaration in ('marked','not_applicable')),
  confirmed_at timestamptz not null default now()
);
create table adme_delivery.events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references adme_delivery.rooms(proposal_id),
  submission_id uuid not null references adme_delivery.submissions(id),
  actor_id uuid not null references public.profiles(id),
  request_key uuid not null,
  expected_revision int not null,
  from_status text not null,
  to_status text not null check(to_status in ('submitted','revision_requested','completed')),
  note text not null,
  advertising_checked boolean not null,
  transaction_id bigint not null default txid_current(),
  created_at timestamptz not null default now(),
  unique(actor_id,proposal_id,request_key),
  unique(proposal_id,expected_revision),
  check(to_status='submitted' or length(btrim(note)) between 10 and 2000),
  check(to_status<>'completed' or advertising_checked)
);
create index delivery_history on adme_delivery.submissions(proposal_id,version desc);
create index delivery_event_submission on adme_delivery.events(submission_id,created_at,id);
alter table adme_delivery.boundary enable row level security;
alter table adme_delivery.rooms enable row level security;
alter table adme_delivery.submissions enable row level security;
alter table adme_delivery.attestations enable row level security;
alter table adme_delivery.events enable row level security;
revoke all on all tables in schema adme_delivery from public,anon,authenticated,service_role;

-- Backfill records what actually exists; never invent old attestations/reviews.
insert into adme_delivery.rooms(proposal_id)
select distinct proposal_id from public.messages where kind='deliverable';
insert into adme_delivery.submissions(id,proposal_id,version,author_id,body,url,legacy,created_at)
select m.id,m.proposal_id,row_number() over(partition by m.proposal_id order by m.created_at,m.id)::int,
  m.sender_id,m.body,case when length(m.url)<=1000 then adme_creator.public_https(m.url) end,true,m.created_at
from public.messages m where m.kind='deliverable';
update adme_delivery.rooms r set submission_count=x.n,revision=x.n,active_id=x.id
from (select distinct on(proposal_id) proposal_id,version n,id from adme_delivery.submissions order by proposal_id,version desc) x where r.proposal_id=x.proposal_id;
update adme_delivery.rooms r set requested_id=r.active_id from public.proposals p,adme_delivery.submissions s
where p.id=r.proposal_id and s.id=r.active_id and p.status='revision_requested' and s.created_at<=p.updated_at;

create function adme_delivery.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'delivery history is immutable' using errcode='23514'; end;
$$;
create trigger delivery_submission_immutable before update or delete on adme_delivery.submissions for each row execute function adme_delivery.immutable();
create trigger delivery_attestation_immutable before update or delete on adme_delivery.attestations for each row execute function adme_delivery.immutable();
create trigger delivery_event_immutable before update or delete on adme_delivery.events for each row execute function adme_delivery.immutable();
create function adme_delivery.boundary_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or (old.enabled and not new.enabled) or
    (old.release_ref is not null and (new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at)) then
    raise exception 'delivery boundary cannot be reopened' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger delivery_boundary_guard before update or delete on adme_delivery.boundary for each row execute function adme_delivery.boundary_guard();
create function adme_delivery.activate(p_release text) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value; end if;
  update adme_delivery.boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;
end;
$$;
create function adme_delivery.enabled() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from adme_delivery.boundary where singleton),true);
$$;
create function adme_delivery.writable(p public.proposals) returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id) and
    exists(select 1 from public.creators cr join public.campaigns ca on ca.id=p.campaign_id
      where cr.id=p.creator_id and cr.moderation_status='allowed' and ca.moderation_status='allowed');
$$;
create function adme_delivery.capture() returns trigger language plpgsql security definer set search_path='' as $$
declare r adme_delivery.rooms;
begin
  if new.kind<>'deliverable' then return new; end if;
  perform 1 from public.proposals where id=new.proposal_id for update;
  insert into adme_delivery.rooms(proposal_id) values(new.proposal_id) on conflict do nothing;
  select * into r from adme_delivery.rooms where proposal_id=new.proposal_id for update;
  insert into adme_delivery.submissions(id,proposal_id,version,author_id,body,url,created_at)
    values(new.id,new.proposal_id,r.submission_count+1,new.sender_id,new.body,
      case when length(new.url)<=1000 then adme_creator.public_https(new.url) end,new.created_at);
  update adme_delivery.rooms set submission_count=r.submission_count+1,revision=r.revision+1,active_id=new.id where proposal_id=new.proposal_id;
  insert into public.audit_log(actor_id,entity_id,action) values(new.sender_id,new.proposal_id::text,'delivery:create:'||(r.submission_count+1));
  return new;
end;
$$;
create trigger delivery_message_capture after insert on public.messages for each row execute function adme_delivery.capture();

create function adme_delivery.attest(p_proposal uuid,p_submission uuid,p_expected int,p_declaration text) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; s adme_delivery.submissions; prior adme_delivery.attestations;
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or p.creator_user_id<>auth.uid() or public.my_role() is distinct from 'creator' then
    raise exception 'creator required' using errcode='42501'; end if;
  if p_submission is null or p_expected is null or p_expected<0 or p_declaration is null or p_declaration not in ('marked','not_applicable') then raise invalid_parameter_value; end if;
  select * into s from adme_delivery.submissions where id=p_submission and proposal_id=p.id and author_id=auth.uid();
  if s.id is null or s.url is null then raise exception 'submission unavailable' using errcode='23514'; end if;
  select * into prior from adme_delivery.attestations where submission_id=s.id;
  if found then
    if prior.declaration<>p_declaration then raise exception 'declaration conflict' using errcode='23505'; end if;
    return true;
  end if;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.proposal_id is null or r.revision<>p_expected or r.active_id is null or r.active_id<>s.id then raise exception 'submission changed' using errcode='40001'; end if;
  if p.status not in ('accepted','revision_requested','submitted') or not adme_delivery.writable(p) then raise exception 'attestation not allowed' using errcode='42501'; end if;
  perform adme_ops.require_quota('delivery_attest',auth.uid()::text,30,3600);
  insert into adme_delivery.attestations(submission_id,actor_id,declaration) values(s.id,auth.uid(),p_declaration);
  update adme_delivery.rooms set managed=true,revision=revision+1 where proposal_id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,'delivery:attest:'||s.version);
  return true;
end;
$$;
create function adme_delivery.create_submission(p_proposal uuid,p_expected int,p_key uuid,p_body text,p_url text,p_declaration text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; prior public.messages; a adme_delivery.attestations; result uuid;
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or p.creator_user_id<>auth.uid() or public.my_role() is distinct from 'creator' then
    raise exception 'creator required' using errcode='42501'; end if;
  if p_key is null or p_expected is null or p_expected<0 or p_body is null or length(btrim(p_body)) not between 1 and 3000
    or p_url is null or length(p_url)>1000 or adme_creator.public_https(p_url) is null
    or p_declaration is null or p_declaration not in ('marked','not_applicable') then raise invalid_parameter_value; end if;
  select * into prior from public.messages where proposal_id=p.id and sender_id=auth.uid() and idempotency_key=p_key;
  if found then
    if prior.body is distinct from btrim(p_body) or prior.url is distinct from p_url or prior.kind<>'deliverable' then raise exception 'request key conflict' using errcode='23505'; end if;
    select * into a from adme_delivery.attestations where submission_id=prior.id;
    if found then
      if a.declaration<>p_declaration then raise exception 'request key conflict' using errcode='23505'; end if;
      return prior.id;
    end if;
  end if;
  insert into adme_delivery.rooms(proposal_id) values(p.id) on conflict do nothing;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.revision<>p_expected then raise exception 'submission changed' using errcode='40001'; end if;
  if p.status not in ('accepted','revision_requested') or not adme_delivery.writable(p) then raise exception 'submission not allowed' using errcode='42501'; end if;
  perform adme_ops.require_quota('delivery_create',auth.uid()::text,20,3600);
  result:=adme_messaging.send(p.id,p_key,btrim(p_body),'deliverable',p_url);
  select * into r from adme_delivery.rooms where proposal_id=p.id;
  perform adme_delivery.attest(p.id,result,r.revision,p_declaration);
  return result;
end;
$$;

-- An immutable intent made by the protected RPC in this exact transaction is
-- required; no caller-controlled GUC can authorize the status update.
create function adme_delivery.guard_status() returns trigger language plpgsql security definer set search_path='' as $$
declare r adme_delivery.rooms; e adme_delivery.events;
begin
  if new.status=old.status then return new; end if;
  select * into r from adme_delivery.rooms where proposal_id=old.id for update;
  if auth.uid() is null and session_user='postgres' then
    update adme_delivery.rooms set revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id; return new;
  end if;
  if new.status in ('submitted','completed','revision_requested') and (adme_delivery.enabled() or coalesce(r.managed,false)) then
    select * into e from adme_delivery.events where proposal_id=old.id and transaction_id=txid_current()
      and expected_revision=r.revision and from_status=old.status and to_status=new.status and submission_id=r.active_id and actor_id=auth.uid();
    if e.id is null then raise exception 'versioned review required' using errcode='40001'; end if;
    update adme_delivery.rooms set managed=true,revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id;
  else
    update adme_delivery.rooms set revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id;
  end if;
  return new;
end;
$$;
create trigger delivery_status_guard before update of status on public.proposals for each row execute function adme_delivery.guard_status();
create function adme_delivery.transition(p_proposal uuid,p_submission uuid,p_expected int,p_key uuid,p_action text,p_note text,p_checked boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; prior adme_delivery.events; note_value text:=coalesce(btrim(p_note),'');
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'participant required' using errcode='42501'; end if;
  if p_key is null or p_expected is null or p_expected<0 or p_submission is null or p_checked is null or p_action is null
    or p_action not in ('submitted','completed','revision_requested') or length(note_value)>2000 then raise invalid_parameter_value; end if;
  select * into prior from adme_delivery.events where proposal_id=p.id and actor_id=auth.uid() and request_key=p_key;
  if found then
    if prior.submission_id<>p_submission or prior.expected_revision<>p_expected or prior.to_status<>p_action
      or prior.note<>note_value or prior.advertising_checked<>p_checked then raise exception 'request key conflict' using errcode='23505'; end if;
    return jsonb_build_object('status',prior.to_status,'roomRevision',prior.expected_revision+1);
  end if;
  if not ((p_action='submitted' and p.creator_user_id=auth.uid() and public.my_role()='creator') or
    (p_action in ('completed','revision_requested') and p.brand_id=auth.uid() and public.my_role()='brand')) then raise exception 'actor not allowed' using errcode='42501'; end if;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.proposal_id is null or r.revision<>p_expected or r.active_id is null or r.active_id<>p_submission then raise exception 'submission changed' using errcode='40001'; end if;
  if not adme_delivery.writable(p) then raise exception 'review not allowed' using errcode='42501'; end if;
  if not ((p_action='submitted' and p.status in ('accepted','revision_requested')) or
    (p_action in ('completed','revision_requested') and p.status='submitted')) then raise exception 'state changed' using errcode='40001'; end if;
  if p_action in ('submitted','completed') and r.requested_id=p_submission then raise exception 'new submission version required' using errcode='23514'; end if;
  if p_action in ('submitted','completed') and not exists(select 1 from adme_delivery.attestations a join adme_delivery.submissions s on s.id=a.submission_id
    where s.id=p_submission and s.proposal_id=p.id and s.author_id=p.creator_user_id and s.url is not null and a.actor_id=p.creator_user_id) then
    raise exception 'advertising declaration required' using errcode='23514'; end if;
  if (p_action<>'submitted' and length(note_value)<10) or (p_action='completed' and not p_checked) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('delivery_transition',auth.uid()::text,30,3600);
  insert into adme_delivery.events(proposal_id,submission_id,actor_id,request_key,expected_revision,from_status,to_status,note,advertising_checked)
    values(p.id,p_submission,auth.uid(),p_key,r.revision,p.status,p_action,note_value,p_checked);
  update public.proposals set status=p_action,updated_at=statement_timestamp() where id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,'delivery:'||p_action||':'||p_submission);
  return jsonb_build_object('status',p_action,'roomRevision',r.revision+1);
end;
$$;
create function adme_delivery.legacy_transition(p_id uuid,p_action text) returns text language plpgsql security definer set search_path='' as $$
declare p public.proposals; r text;
begin
  select * into p from public.proposals where id=p_id for update;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_action is null or p_action not in ('accepted','rejected','submitted','completed','revision_requested') then raise invalid_parameter_value; end if;
  r:=case when auth.uid()=p.brand_id then 'brand' else 'creator' end;
  if p_action in ('submitted','completed','revision_requested') and (adme_delivery.enabled() or coalesce((select managed from adme_delivery.rooms where proposal_id=p.id),false)) then
    raise exception 'versioned review required' using errcode='40001'; end if;
  if not ((p.status='pending' and p_action in ('accepted','rejected') and r=case when p.kind='proposal' then 'creator' else 'brand' end)
    or (p.status in ('accepted','revision_requested') and p_action='submitted' and r='creator' and exists(select 1 from public.messages where proposal_id=p.id and kind='deliverable'))
    or (p.status='submitted' and p_action in ('completed','revision_requested') and r='brand')) then raise exception 'invalid transition' using errcode='40001'; end if;
  perform adme_ops.require_quota('delivery_legacy_transition',auth.uid()::text,30,3600);
  update public.proposals set status=p_action,updated_at=now() where id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,p_action);
  return p_action;
end;
$$;
create or replace function public.transition_proposal(p_id uuid,p_action text) returns text
language sql security invoker set search_path='' as $$ select adme_delivery.legacy_transition($1,$2); $$;

create function adme_delivery.dto(p_submission uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'version',s.version,'body',s.body,'url',s.url,'legacy',s.legacy,'createdAt',s.created_at,
    'attestation',(select jsonb_build_object('declaration',a.declaration,'confirmedAt',a.confirmed_at) from adme_delivery.attestations a where a.submission_id=s.id),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.to_status,'note',e.note,'advertisingChecked',e.advertising_checked,'createdAt',e.created_at) order by e.created_at,e.id),'[]'::jsonb)
      from adme_delivery.events e where e.submission_id=s.id)) from adme_delivery.submissions s where s.id=p_submission;
$$;
create function adme_delivery.page(p_proposal uuid,p_before int,p_limit int) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; active jsonb; items jsonb; next_version int; writable boolean;
begin
  select * into p from public.proposals where id=p_proposal for share;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'participant required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or (p_before is not null and p_before<1) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('delivery_read',auth.uid()::text,120,60);
  select * into r from adme_delivery.rooms where proposal_id=p.id for share;
  active:=adme_delivery.dto(r.active_id); writable:=adme_delivery.writable(p);
  with rows as (select s.id,s.version,row_number() over(order by s.version desc) n from adme_delivery.submissions s
    where s.proposal_id=p.id and (p_before is null or s.version<p_before) order by s.version desc limit p_limit+1)
  select coalesce(jsonb_agg(adme_delivery.dto(id) order by version desc) filter(where n<=p_limit),'[]'::jsonb),
    case when count(*)>p_limit then min(version) filter(where n<=p_limit) else null end into items,next_version from rows;
  return jsonb_build_object('version',1,'proposalId',p.id,'status',p.status,'roomRevision',coalesce(r.revision,0),'enforced',adme_delivery.enabled() or coalesce(r.managed,false),
    'legacyCompleted',p.status='completed' and not exists(select 1 from adme_delivery.events e where e.proposal_id=p.id and e.to_status='completed'),
    'canCreate',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested'),
    'canAttest',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested','submitted')
      and exists(select 1 from adme_delivery.submissions s where s.id=r.active_id and s.author_id=auth.uid() and s.url is not null) and active->'attestation'='null'::jsonb,
    'canSubmit',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested') and coalesce(active->'attestation'<>'null'::jsonb,false) and r.requested_id is distinct from r.active_id,
    'canReview',writable and p.brand_id=auth.uid() and public.my_role()='brand' and p.status='submitted',
    'needsNewVersion',r.requested_id is not null and r.requested_id=r.active_id,
    'active',active,'items',items,'nextVersion',next_version);
end;
$$;
create function public.delivery_create(p_proposal uuid,p_expected int,p_key uuid,p_body text,p_url text,p_declaration text) returns uuid language sql security invoker set search_path='' as $$ select adme_delivery.create_submission($1,$2,$3,$4,$5,$6); $$;
create function public.delivery_attest(p_proposal uuid,p_submission uuid,p_expected int,p_declaration text) returns boolean language sql security invoker set search_path='' as $$ select adme_delivery.attest($1,$2,$3,$4); $$;
create function public.delivery_transition(p_proposal uuid,p_submission uuid,p_expected int,p_key uuid,p_action text,p_note text default '',p_checked boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select adme_delivery.transition($1,$2,$3,$4,$5,$6,$7); $$;
create function public.delivery_page(p_proposal uuid,p_before int default null,p_limit int default 20) returns jsonb language sql security invoker set search_path='' as $$ select adme_delivery.page($1,$2,$3); $$;
revoke all on all functions in schema adme_delivery from public,anon,authenticated,service_role;
grant execute on function adme_delivery.create_submission(uuid,int,uuid,text,text,text),adme_delivery.attest(uuid,uuid,int,text),adme_delivery.transition(uuid,uuid,int,uuid,text,text,boolean),adme_delivery.legacy_transition(uuid,text),adme_delivery.page(uuid,int,int) to authenticated;
revoke all on function public.delivery_create(uuid,int,uuid,text,text,text),public.delivery_attest(uuid,uuid,int,text),public.delivery_transition(uuid,uuid,int,uuid,text,text,boolean),public.delivery_page(uuid,int,int),public.transition_proposal(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.delivery_create(uuid,int,uuid,text,text,text),public.delivery_attest(uuid,uuid,int,text),public.delivery_transition(uuid,uuid,int,uuid,text,text,boolean),public.delivery_page(uuid,int,int),public.transition_proposal(uuid,text) to authenticated;
notify pgrst,'reload schema';

insert into supabase_migrations.schema_migrations(version,name,statements) values('202611200025','deliverable_versions',array[$delivery_source$-- D054: immutable submission snapshots and actor/version-bound review events.
begin;
create schema adme_delivery;
revoke all on schema adme_delivery from public,anon,authenticated,service_role;
grant usage on schema adme_delivery to authenticated;
create table adme_delivery.boundary (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default true,
  release_ref text,
  activated_at timestamptz
);
insert into adme_delivery.boundary(singleton,enabled)
values(true,current_setting('adme.delivery_staging',true) is distinct from 'on');
create table adme_delivery.rooms (
  proposal_id uuid primary key references public.proposals(id),
  revision int not null default 0 check(revision>=0),
  submission_count int not null default 0 check(submission_count>=0),
  active_id uuid,
  requested_id uuid,
  managed boolean not null default false
);
create table adme_delivery.submissions (
  id uuid primary key references public.messages(id),
  proposal_id uuid not null references adme_delivery.rooms(proposal_id),
  version int not null check(version>0),
  author_id uuid not null references public.profiles(id),
  body text not null,
  url text,
  legacy boolean not null default false,
  created_at timestamptz not null,
  unique(proposal_id,version)
);
alter table adme_delivery.rooms add constraint delivery_active_fk foreign key(active_id) references adme_delivery.submissions(id);
alter table adme_delivery.rooms add constraint delivery_requested_fk foreign key(requested_id) references adme_delivery.submissions(id);
create table adme_delivery.attestations (
  submission_id uuid primary key references adme_delivery.submissions(id),
  actor_id uuid not null references public.profiles(id),
  declaration text not null check(declaration in ('marked','not_applicable')),
  confirmed_at timestamptz not null default now()
);
create table adme_delivery.events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references adme_delivery.rooms(proposal_id),
  submission_id uuid not null references adme_delivery.submissions(id),
  actor_id uuid not null references public.profiles(id),
  request_key uuid not null,
  expected_revision int not null,
  from_status text not null,
  to_status text not null check(to_status in ('submitted','revision_requested','completed')),
  note text not null,
  advertising_checked boolean not null,
  transaction_id bigint not null default txid_current(),
  created_at timestamptz not null default now(),
  unique(actor_id,proposal_id,request_key),
  unique(proposal_id,expected_revision),
  check(to_status='submitted' or length(btrim(note)) between 10 and 2000),
  check(to_status<>'completed' or advertising_checked)
);
create index delivery_history on adme_delivery.submissions(proposal_id,version desc);
create index delivery_event_submission on adme_delivery.events(submission_id,created_at,id);
alter table adme_delivery.boundary enable row level security;
alter table adme_delivery.rooms enable row level security;
alter table adme_delivery.submissions enable row level security;
alter table adme_delivery.attestations enable row level security;
alter table adme_delivery.events enable row level security;
revoke all on all tables in schema adme_delivery from public,anon,authenticated,service_role;

-- Backfill records what actually exists; never invent old attestations/reviews.
insert into adme_delivery.rooms(proposal_id)
select distinct proposal_id from public.messages where kind='deliverable';
insert into adme_delivery.submissions(id,proposal_id,version,author_id,body,url,legacy,created_at)
select m.id,m.proposal_id,row_number() over(partition by m.proposal_id order by m.created_at,m.id)::int,
  m.sender_id,m.body,case when length(m.url)<=1000 then adme_creator.public_https(m.url) end,true,m.created_at
from public.messages m where m.kind='deliverable';
update adme_delivery.rooms r set submission_count=x.n,revision=x.n,active_id=x.id
from (select distinct on(proposal_id) proposal_id,version n,id from adme_delivery.submissions order by proposal_id,version desc) x where r.proposal_id=x.proposal_id;
update adme_delivery.rooms r set requested_id=r.active_id from public.proposals p,adme_delivery.submissions s
where p.id=r.proposal_id and s.id=r.active_id and p.status='revision_requested' and s.created_at<=p.updated_at;

create function adme_delivery.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'delivery history is immutable' using errcode='23514'; end;
$$;
create trigger delivery_submission_immutable before update or delete on adme_delivery.submissions for each row execute function adme_delivery.immutable();
create trigger delivery_attestation_immutable before update or delete on adme_delivery.attestations for each row execute function adme_delivery.immutable();
create trigger delivery_event_immutable before update or delete on adme_delivery.events for each row execute function adme_delivery.immutable();
create function adme_delivery.boundary_guard() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or (old.enabled and not new.enabled) or
    (old.release_ref is not null and (new.release_ref is distinct from old.release_ref or new.activated_at is distinct from old.activated_at)) then
    raise exception 'delivery boundary cannot be reopened' using errcode='23514'; end if;
  return new;
end;
$$;
create trigger delivery_boundary_guard before update or delete on adme_delivery.boundary for each row execute function adme_delivery.boundary_guard();
create function adme_delivery.activate(p_release text) returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_release is null or p_release !~ '^[a-f0-9]{7,40}$' then raise invalid_parameter_value; end if;
  update adme_delivery.boundary set enabled=true,release_ref=coalesce(release_ref,p_release),activated_at=coalesce(activated_at,statement_timestamp()) where singleton;
end;
$$;
create function adme_delivery.enabled() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((select enabled from adme_delivery.boundary where singleton),true);
$$;
create function adme_delivery.writable(p public.proposals) returns boolean language sql stable security definer set search_path='' as $$
  select not exists(select 1 from adme_messaging.blocks b where b.proposal_id=p.id) and
    exists(select 1 from public.creators cr join public.campaigns ca on ca.id=p.campaign_id
      where cr.id=p.creator_id and cr.moderation_status='allowed' and ca.moderation_status='allowed');
$$;
create function adme_delivery.capture() returns trigger language plpgsql security definer set search_path='' as $$
declare r adme_delivery.rooms;
begin
  if new.kind<>'deliverable' then return new; end if;
  perform 1 from public.proposals where id=new.proposal_id for update;
  insert into adme_delivery.rooms(proposal_id) values(new.proposal_id) on conflict do nothing;
  select * into r from adme_delivery.rooms where proposal_id=new.proposal_id for update;
  insert into adme_delivery.submissions(id,proposal_id,version,author_id,body,url,created_at)
    values(new.id,new.proposal_id,r.submission_count+1,new.sender_id,new.body,
      case when length(new.url)<=1000 then adme_creator.public_https(new.url) end,new.created_at);
  update adme_delivery.rooms set submission_count=r.submission_count+1,revision=r.revision+1,active_id=new.id where proposal_id=new.proposal_id;
  insert into public.audit_log(actor_id,entity_id,action) values(new.sender_id,new.proposal_id::text,'delivery:create:'||(r.submission_count+1));
  return new;
end;
$$;
create trigger delivery_message_capture after insert on public.messages for each row execute function adme_delivery.capture();

create function adme_delivery.attest(p_proposal uuid,p_submission uuid,p_expected int,p_declaration text) returns boolean
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; s adme_delivery.submissions; prior adme_delivery.attestations;
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or p.creator_user_id<>auth.uid() or public.my_role() is distinct from 'creator' then
    raise exception 'creator required' using errcode='42501'; end if;
  if p_submission is null or p_expected is null or p_expected<0 or p_declaration is null or p_declaration not in ('marked','not_applicable') then raise invalid_parameter_value; end if;
  select * into s from adme_delivery.submissions where id=p_submission and proposal_id=p.id and author_id=auth.uid();
  if s.id is null or s.url is null then raise exception 'submission unavailable' using errcode='23514'; end if;
  select * into prior from adme_delivery.attestations where submission_id=s.id;
  if found then
    if prior.declaration<>p_declaration then raise exception 'declaration conflict' using errcode='23505'; end if;
    return true;
  end if;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.proposal_id is null or r.revision<>p_expected or r.active_id is null or r.active_id<>s.id then raise exception 'submission changed' using errcode='40001'; end if;
  if p.status not in ('accepted','revision_requested','submitted') or not adme_delivery.writable(p) then raise exception 'attestation not allowed' using errcode='42501'; end if;
  perform adme_ops.require_quota('delivery_attest',auth.uid()::text,30,3600);
  insert into adme_delivery.attestations(submission_id,actor_id,declaration) values(s.id,auth.uid(),p_declaration);
  update adme_delivery.rooms set managed=true,revision=revision+1 where proposal_id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,'delivery:attest:'||s.version);
  return true;
end;
$$;
create function adme_delivery.create_submission(p_proposal uuid,p_expected int,p_key uuid,p_body text,p_url text,p_declaration text) returns uuid
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; prior public.messages; a adme_delivery.attestations; result uuid;
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or p.creator_user_id<>auth.uid() or public.my_role() is distinct from 'creator' then
    raise exception 'creator required' using errcode='42501'; end if;
  if p_key is null or p_expected is null or p_expected<0 or p_body is null or length(btrim(p_body)) not between 1 and 3000
    or p_url is null or length(p_url)>1000 or adme_creator.public_https(p_url) is null
    or p_declaration is null or p_declaration not in ('marked','not_applicable') then raise invalid_parameter_value; end if;
  select * into prior from public.messages where proposal_id=p.id and sender_id=auth.uid() and idempotency_key=p_key;
  if found then
    if prior.body is distinct from btrim(p_body) or prior.url is distinct from p_url or prior.kind<>'deliverable' then raise exception 'request key conflict' using errcode='23505'; end if;
    select * into a from adme_delivery.attestations where submission_id=prior.id;
    if found then
      if a.declaration<>p_declaration then raise exception 'request key conflict' using errcode='23505'; end if;
      return prior.id;
    end if;
  end if;
  insert into adme_delivery.rooms(proposal_id) values(p.id) on conflict do nothing;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.revision<>p_expected then raise exception 'submission changed' using errcode='40001'; end if;
  if p.status not in ('accepted','revision_requested') or not adme_delivery.writable(p) then raise exception 'submission not allowed' using errcode='42501'; end if;
  perform adme_ops.require_quota('delivery_create',auth.uid()::text,20,3600);
  result:=adme_messaging.send(p.id,p_key,btrim(p_body),'deliverable',p_url);
  select * into r from adme_delivery.rooms where proposal_id=p.id;
  perform adme_delivery.attest(p.id,result,r.revision,p_declaration);
  return result;
end;
$$;

-- An immutable intent made by the protected RPC in this exact transaction is
-- required; no caller-controlled GUC can authorize the status update.
create function adme_delivery.guard_status() returns trigger language plpgsql security definer set search_path='' as $$
declare r adme_delivery.rooms; e adme_delivery.events;
begin
  if new.status=old.status then return new; end if;
  select * into r from adme_delivery.rooms where proposal_id=old.id for update;
  if auth.uid() is null and session_user='postgres' then
    update adme_delivery.rooms set revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id; return new;
  end if;
  if new.status in ('submitted','completed','revision_requested') and (adme_delivery.enabled() or coalesce(r.managed,false)) then
    select * into e from adme_delivery.events where proposal_id=old.id and transaction_id=txid_current()
      and expected_revision=r.revision and from_status=old.status and to_status=new.status and submission_id=r.active_id and actor_id=auth.uid();
    if e.id is null then raise exception 'versioned review required' using errcode='40001'; end if;
    update adme_delivery.rooms set managed=true,revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id;
  else
    update adme_delivery.rooms set revision=revision+1,requested_id=case when new.status='revision_requested' then active_id else requested_id end where proposal_id=old.id;
  end if;
  return new;
end;
$$;
create trigger delivery_status_guard before update of status on public.proposals for each row execute function adme_delivery.guard_status();
create function adme_delivery.transition(p_proposal uuid,p_submission uuid,p_expected int,p_key uuid,p_action text,p_note text,p_checked boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; prior adme_delivery.events; note_value text:=coalesce(btrim(p_note),'');
begin
  select * into p from public.proposals where id=p_proposal for update;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'participant required' using errcode='42501'; end if;
  if p_key is null or p_expected is null or p_expected<0 or p_submission is null or p_checked is null or p_action is null
    or p_action not in ('submitted','completed','revision_requested') or length(note_value)>2000 then raise invalid_parameter_value; end if;
  select * into prior from adme_delivery.events where proposal_id=p.id and actor_id=auth.uid() and request_key=p_key;
  if found then
    if prior.submission_id<>p_submission or prior.expected_revision<>p_expected or prior.to_status<>p_action
      or prior.note<>note_value or prior.advertising_checked<>p_checked then raise exception 'request key conflict' using errcode='23505'; end if;
    return jsonb_build_object('status',prior.to_status,'roomRevision',prior.expected_revision+1);
  end if;
  if not ((p_action='submitted' and p.creator_user_id=auth.uid() and public.my_role()='creator') or
    (p_action in ('completed','revision_requested') and p.brand_id=auth.uid() and public.my_role()='brand')) then raise exception 'actor not allowed' using errcode='42501'; end if;
  select * into r from adme_delivery.rooms where proposal_id=p.id for update;
  if r.proposal_id is null or r.revision<>p_expected or r.active_id is null or r.active_id<>p_submission then raise exception 'submission changed' using errcode='40001'; end if;
  if not adme_delivery.writable(p) then raise exception 'review not allowed' using errcode='42501'; end if;
  if not ((p_action='submitted' and p.status in ('accepted','revision_requested')) or
    (p_action in ('completed','revision_requested') and p.status='submitted')) then raise exception 'state changed' using errcode='40001'; end if;
  if p_action in ('submitted','completed') and r.requested_id=p_submission then raise exception 'new submission version required' using errcode='23514'; end if;
  if p_action in ('submitted','completed') and not exists(select 1 from adme_delivery.attestations a join adme_delivery.submissions s on s.id=a.submission_id
    where s.id=p_submission and s.proposal_id=p.id and s.author_id=p.creator_user_id and s.url is not null and a.actor_id=p.creator_user_id) then
    raise exception 'advertising declaration required' using errcode='23514'; end if;
  if (p_action<>'submitted' and length(note_value)<10) or (p_action='completed' and not p_checked) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('delivery_transition',auth.uid()::text,30,3600);
  insert into adme_delivery.events(proposal_id,submission_id,actor_id,request_key,expected_revision,from_status,to_status,note,advertising_checked)
    values(p.id,p_submission,auth.uid(),p_key,r.revision,p.status,p_action,note_value,p_checked);
  update public.proposals set status=p_action,updated_at=statement_timestamp() where id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,'delivery:'||p_action||':'||p_submission);
  return jsonb_build_object('status',p_action,'roomRevision',r.revision+1);
end;
$$;
create function adme_delivery.legacy_transition(p_id uuid,p_action text) returns text language plpgsql security definer set search_path='' as $$
declare p public.proposals; r text;
begin
  select * into p from public.proposals where id=p_id for update;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'forbidden' using errcode='42501'; end if;
  if p_action is null or p_action not in ('accepted','rejected','submitted','completed','revision_requested') then raise invalid_parameter_value; end if;
  r:=case when auth.uid()=p.brand_id then 'brand' else 'creator' end;
  if p_action in ('submitted','completed','revision_requested') and (adme_delivery.enabled() or coalesce((select managed from adme_delivery.rooms where proposal_id=p.id),false)) then
    raise exception 'versioned review required' using errcode='40001'; end if;
  if not ((p.status='pending' and p_action in ('accepted','rejected') and r=case when p.kind='proposal' then 'creator' else 'brand' end)
    or (p.status in ('accepted','revision_requested') and p_action='submitted' and r='creator' and exists(select 1 from public.messages where proposal_id=p.id and kind='deliverable'))
    or (p.status='submitted' and p_action in ('completed','revision_requested') and r='brand')) then raise exception 'invalid transition' using errcode='40001'; end if;
  perform adme_ops.require_quota('delivery_legacy_transition',auth.uid()::text,30,3600);
  update public.proposals set status=p_action,updated_at=now() where id=p.id;
  insert into public.audit_log(actor_id,entity_id,action) values(auth.uid(),p.id::text,p_action);
  return p_action;
end;
$$;
create or replace function public.transition_proposal(p_id uuid,p_action text) returns text
language sql security invoker set search_path='' as $$ select adme_delivery.legacy_transition($1,$2); $$;

create function adme_delivery.dto(p_submission uuid) returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',s.id,'version',s.version,'body',s.body,'url',s.url,'legacy',s.legacy,'createdAt',s.created_at,
    'attestation',(select jsonb_build_object('declaration',a.declaration,'confirmedAt',a.confirmed_at) from adme_delivery.attestations a where a.submission_id=s.id),
    'events',(select coalesce(jsonb_agg(jsonb_build_object('action',e.to_status,'note',e.note,'advertisingChecked',e.advertising_checked,'createdAt',e.created_at) order by e.created_at,e.id),'[]'::jsonb)
      from adme_delivery.events e where e.submission_id=s.id)) from adme_delivery.submissions s where s.id=p_submission;
$$;
create function adme_delivery.page(p_proposal uuid,p_before int,p_limit int) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.proposals; r adme_delivery.rooms; active jsonb; items jsonb; next_version int; writable boolean;
begin
  select * into p from public.proposals where id=p_proposal for share;
  if auth.uid() is null or p.id is null or auth.uid() not in (p.brand_id,p.creator_user_id) then raise exception 'participant required' using errcode='42501'; end if;
  if p_limit is null or p_limit not between 1 and 50 or (p_before is not null and p_before<1) then raise invalid_parameter_value; end if;
  perform adme_ops.require_quota('delivery_read',auth.uid()::text,120,60);
  select * into r from adme_delivery.rooms where proposal_id=p.id for share;
  active:=adme_delivery.dto(r.active_id); writable:=adme_delivery.writable(p);
  with rows as (select s.id,s.version,row_number() over(order by s.version desc) n from adme_delivery.submissions s
    where s.proposal_id=p.id and (p_before is null or s.version<p_before) order by s.version desc limit p_limit+1)
  select coalesce(jsonb_agg(adme_delivery.dto(id) order by version desc) filter(where n<=p_limit),'[]'::jsonb),
    case when count(*)>p_limit then min(version) filter(where n<=p_limit) else null end into items,next_version from rows;
  return jsonb_build_object('version',1,'proposalId',p.id,'status',p.status,'roomRevision',coalesce(r.revision,0),'enforced',adme_delivery.enabled() or coalesce(r.managed,false),
    'legacyCompleted',p.status='completed' and not exists(select 1 from adme_delivery.events e where e.proposal_id=p.id and e.to_status='completed'),
    'canCreate',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested'),
    'canAttest',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested','submitted')
      and exists(select 1 from adme_delivery.submissions s where s.id=r.active_id and s.author_id=auth.uid() and s.url is not null) and active->'attestation'='null'::jsonb,
    'canSubmit',writable and p.creator_user_id=auth.uid() and public.my_role()='creator' and p.status in ('accepted','revision_requested') and coalesce(active->'attestation'<>'null'::jsonb,false) and r.requested_id is distinct from r.active_id,
    'canReview',writable and p.brand_id=auth.uid() and public.my_role()='brand' and p.status='submitted',
    'needsNewVersion',r.requested_id is not null and r.requested_id=r.active_id,
    'active',active,'items',items,'nextVersion',next_version);
end;
$$;
create function public.delivery_create(p_proposal uuid,p_expected int,p_key uuid,p_body text,p_url text,p_declaration text) returns uuid language sql security invoker set search_path='' as $$ select adme_delivery.create_submission($1,$2,$3,$4,$5,$6); $$;
create function public.delivery_attest(p_proposal uuid,p_submission uuid,p_expected int,p_declaration text) returns boolean language sql security invoker set search_path='' as $$ select adme_delivery.attest($1,$2,$3,$4); $$;
create function public.delivery_transition(p_proposal uuid,p_submission uuid,p_expected int,p_key uuid,p_action text,p_note text default '',p_checked boolean default false) returns jsonb language sql security invoker set search_path='' as $$ select adme_delivery.transition($1,$2,$3,$4,$5,$6,$7); $$;
create function public.delivery_page(p_proposal uuid,p_before int default null,p_limit int default 20) returns jsonb language sql security invoker set search_path='' as $$ select adme_delivery.page($1,$2,$3); $$;
revoke all on all functions in schema adme_delivery from public,anon,authenticated,service_role;
grant execute on function adme_delivery.create_submission(uuid,int,uuid,text,text,text),adme_delivery.attest(uuid,uuid,int,text),adme_delivery.transition(uuid,uuid,int,uuid,text,text,boolean),adme_delivery.legacy_transition(uuid,text),adme_delivery.page(uuid,int,int) to authenticated;
revoke all on function public.delivery_create(uuid,int,uuid,text,text,text),public.delivery_attest(uuid,uuid,int,text),public.delivery_transition(uuid,uuid,int,uuid,text,text,boolean),public.delivery_page(uuid,int,int),public.transition_proposal(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.delivery_create(uuid,int,uuid,text,text,text),public.delivery_attest(uuid,uuid,int,text),public.delivery_transition(uuid,uuid,int,uuid,text,text,boolean),public.delivery_page(uuid,int,int),public.transition_proposal(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
$delivery_source$]);
commit;
