begin;
create table adme_ops.chat_safety (
 proposal_id uuid not null references public.proposals(id) on delete cascade,
 actor_id uuid not null references public.profiles(id),
 action text not null check (action in ('block','report')),
 reason text,
 created_at timestamptz not null default now(),
 primary key(proposal_id,actor_id,action)
);
alter table adme_ops.chat_safety enable row level security;
create function adme_ops.chat_allowed(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.proposals p where p.id=p_id
 and auth.uid() in (p.brand_id,p.creator_user_id) and p.status<>'rejected'
 and (p.status<>'pending' or not adme_ops.marketplace_locked(p.campaign_id))
 and not exists(select 1 from adme_ops.chat_safety b where b.proposal_id=p_id and b.action='block'))
$$;
revoke all on function adme_ops.chat_allowed(uuid) from public,anon,authenticated;
grant execute on function adme_ops.chat_allowed(uuid) to authenticated;
alter policy messages_insert on public.messages to authenticated
 with check(sender_id=auth.uid() and adme_ops.chat_allowed(proposal_id)
 and (kind='message' or exists(select 1 from public.proposals p where p.id=proposal_id
 and p.creator_user_id=auth.uid() and p.status in ('accepted','revision_requested'))));

create function adme_ops.chat_control(p_id uuid,p_action text,p_reason text default '') returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid();
begin
 if actor is null or not exists(select 1 from public.proposals p where p.id=p_id
   and actor in (p.brand_id,p.creator_user_id)) then raise insufficient_privilege; end if;
 if p_action='unblock' then
   delete from adme_ops.chat_safety where proposal_id=p_id and actor_id=actor and action='block';
 elsif p_action in ('block','report') then
   if p_action='report' and (p_reason is null or char_length(btrim(p_reason)) not between 5 and 500)
   then raise invalid_parameter_value; end if;
   insert into adme_ops.chat_safety(proposal_id,actor_id,action,reason)
   values(p_id,actor,p_action,case when p_action='report' then btrim(p_reason) end) on conflict do nothing;
 else raise invalid_parameter_value;
 end if;
end;
$$;
create function adme_ops.chat_report_queue() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if coalesce(adme_ops.staff_role(),'') not in ('super','support') then raise insufficient_privilege; end if;
 return (select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
   select proposal_id,reason,created_at from adme_ops.chat_safety where action='report'
   order by created_at desc limit 30) r);
end;
$$;
create function public.chat_control(p_id uuid,p_action text,p_reason text default '') returns void
language sql security invoker set search_path='' as $$select adme_ops.chat_control($1,$2,$3)$$;
create function public.chat_report_queue() returns jsonb
language sql stable security invoker set search_path='' as $$select adme_ops.chat_report_queue()$$;
revoke all on function public.chat_control(uuid,text,text), adme_ops.chat_control(uuid,text,text),
 public.chat_report_queue(),adme_ops.chat_report_queue() from public,anon,authenticated;
grant execute on function public.chat_control(uuid,text,text), adme_ops.chat_control(uuid,text,text),
 public.chat_report_queue(),adme_ops.chat_report_queue() to authenticated;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime'
     and schemaname='public' and tablename='messages') then
   alter publication supabase_realtime add table public.messages;
 end if;
end;
$$;
commit;
