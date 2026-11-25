-- D037: opt-in in-app "new candidate" alerts for saved searches.
-- Matching reuses the catalog matcher (adme_creator.filtered_page) as the owner, so alerts show exactly what the
-- owner would see and use the owner's own catalog quota. Each creator alerts at most once per condition revision;
-- opting in or changing filters re-baselines silently (no alert for already-matching creators). Email stays off
-- until D053 (the D015 service-email trigger skips this kind).
begin;
alter table adme_search.saved_conditions
 add column notify boolean not null default false,
 add column baseline_revision int;
create table adme_search.seen_candidates(
 condition_id uuid not null references adme_search.saved_conditions(id)on delete cascade,
 creator_id text not null references public.creators(id)on delete cascade,
 primary key(condition_id,creator_id));
alter table adme_search.seen_candidates enable row level security;
revoke all on adme_search.seen_candidates from public,anon,authenticated,service_role;

-- Expand D052 notifications (DEV-B) additively: proposal rows unchanged; a saved-search row has no proposal.
alter table public.notifications
 alter column proposal_id drop not null,
 add column saved_search_id uuid references adme_search.saved_conditions(id)on delete cascade,
 add column new_count int check(new_count between 1 and 100000),
 drop constraint notifications_kind_check,
 add constraint notifications_kind_check check(kind in('status','message','deliverable','saved_search')),
 add constraint notifications_subject check(case when kind='saved_search'
  then proposal_id is null and saved_search_id is not null and new_count is not null
  else proposal_id is not null and saved_search_id is null and new_count is null end);
create index on public.notifications(saved_search_id)where saved_search_id is not null;
drop policy notifications_read on public.notifications;
create policy notifications_read on public.notifications for select using(user_id=auth.uid()and(
 (kind='saved_search'and public.account_access())
 or exists(select 1 from public.proposals p where p.id=proposal_id and auth.uid()in(p.brand_id,p.creator_user_id))));
drop trigger adme_service_email on public.notifications;
create trigger adme_service_email after insert on public.notifications for each row
 when(new.kind<>'saved_search')execute function public.enqueue_service_email();

create function adme_search.scan_condition(p_id uuid)returns int language plpgsql security definer set search_path=''as $$
declare c adme_search.saved_conditions; page jsonb; cur text; n int; added int:=0; baseline boolean;
begin
 -- Skip a row being edited right now; the next tick sees its new revision.
 select * into c from adme_search.saved_conditions where id=p_id and notify for update skip locked;
 if not found then return 0;end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c.owner_id,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',c.owner_id::text,true);
 if not public.account_access()then return 0;end if;
 baseline:=c.baseline_revision is distinct from c.revision;
 if baseline then delete from adme_search.seen_candidates where condition_id=c.id;end if;
 loop
  page:=adme_creator.filtered_page(c.filters,cur,100,adme_release.demo_catalog_enabled());
  insert into adme_search.seen_candidates(condition_id,creator_id)
   select c.id,r from jsonb_array_elements(page->'items')x cross join lateral adme_creator.resolve_reference(x->>'seed_id')r
   where r is not null on conflict do nothing;
  get diagnostics n=row_count;added:=added+n;
  cur:=page->>'nextCursor';exit when cur is null;
 end loop;
 update adme_search.saved_conditions set baseline_revision=c.revision where id=c.id;
 if baseline or added=0 then return 0;end if;
 insert into public.notifications(user_id,kind,saved_search_id,new_count,source_key)
  values(c.owner_id,'saved_search',c.id,added,'saved_search:'||c.id||':'||gen_random_uuid());
 return added;
end;$$;
create function adme_search.scan_alerts()returns int language plpgsql security definer set search_path=''as $$
declare i uuid; total int:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('adme-saved-search-alerts'))then return 0;end if;
 for i in select id from adme_search.saved_conditions where notify order by owner_id,id loop
  begin total:=total+adme_search.scan_condition(i);
  exception when sqlstate 'PGRST' then null; -- owner's catalog quota is spent; retry next tick, seen set unchanged
  end;
 end loop;
 perform set_config('request.jwt.claims','',true);
 perform set_config('request.jwt.claim.sub','',true);
 return total;
end;$$;

create function public.saved_search_alerts(p_id uuid,p_expected int,p_notify boolean)returns void language plpgsql security definer set search_path=''as $$
declare old adme_search.saved_conditions;
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 if p_id is null or p_expected is null or p_notify is null then raise invalid_parameter_value;end if;
 perform adme_ops.require_quota('saved_search_write',auth.uid()::text,30,60);
 select * into old from adme_search.saved_conditions where id=p_id and owner_id=auth.uid()for update;
 if not found then raise no_data_found;end if;
 if old.revision<>p_expected then raise exception 'stale revision'using errcode='40001';end if;
 update adme_search.saved_conditions set notify=p_notify,baseline_revision=null,revision=revision+1,updated_at=statement_timestamp()where id=p_id;
end;$$;
create or replace function public.saved_search_list()returns jsonb language plpgsql security definer set search_path=''as $$
begin
 if auth.uid()is null or not public.account_access()then raise insufficient_privilege;end if;
 perform adme_ops.require_quota('saved_search_read',auth.uid()::text,60,60);
 return coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'filterVersion',filter_version,'filters',filters,'revision',revision,'notify',notify)order by updated_at desc,id)from adme_search.saved_conditions where owner_id=auth.uid()),'[]'::jsonb);
end;$$;
revoke all on function adme_search.scan_condition(uuid),adme_search.scan_alerts(),public.saved_search_alerts(uuid,int,boolean)from public,anon,authenticated,service_role;
grant execute on function public.saved_search_alerts(uuid,int,boolean)to authenticated;
select cron.schedule('adme-saved-search-alerts','*/15 * * * *','select adme_search.scan_alerts()');
notify pgrst,'reload schema';
commit;
