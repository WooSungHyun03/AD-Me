-- D055: append-only history of campaign schedule (recruitment/production/posting window) changes.
-- Recorded by trigger so every update path is covered; readable only by the campaign owner and parties of its proposals.
-- Compensation/deliverable edits are not schedule changes and are not recorded here.
begin;
create table public.campaign_schedule_changes(
 id bigint generated always as identity primary key,
 campaign_id uuid not null references public.campaigns(id) on delete cascade,
 actor_id uuid,
 previous jsonb not null,
 next jsonb not null,
 changed_at timestamptz not null default statement_timestamp());
create index campaign_schedule_changes_campaign on public.campaign_schedule_changes(campaign_id,changed_at desc);
alter table public.campaign_schedule_changes enable row level security;
create policy campaign_schedule_changes_read on public.campaign_schedule_changes for select to authenticated using(
 exists(select 1 from public.campaigns c where c.id=campaign_id and c.owner_id=(select auth.uid()))
 or exists(select 1 from public.proposals p where p.campaign_id=campaign_schedule_changes.campaign_id
  and (select auth.uid()) in(p.brand_id,p.creator_user_id)));
revoke all on public.campaign_schedule_changes from public,anon,authenticated;
grant select on public.campaign_schedule_changes to authenticated;

create function adme_ops.record_schedule_change()returns trigger
language plpgsql security definer set search_path=''as $$
declare a jsonb:=(old.brief->'terms')-array['version','compensation','deliverables'];
 b jsonb:=(new.brief->'terms')-array['version','compensation','deliverables'];
begin
 -- First structuring of a legacy campaign is not a change.
 if old.brief?'terms' and a is distinct from b then
  insert into public.campaign_schedule_changes(campaign_id,actor_id,previous,next)values(new.id,auth.uid(),a,b);
 end if;
 return null;
end $$;
revoke all on function adme_ops.record_schedule_change()from public,anon,authenticated,service_role;
create trigger campaign_schedule_history after update of brief on public.campaigns
 for each row execute function adme_ops.record_schedule_change();
notify pgrst,'reload schema';
commit;
