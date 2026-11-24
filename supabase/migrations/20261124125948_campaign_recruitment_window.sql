-- D043: one application gate for REST, legacy proposal RPC and marketplace RPC.
-- Legacy briefs with no structured window retain their original deadline/capacity rules.
create function adme_ops.campaign_accepting_at(c public.campaigns, at_time timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(c.status='published' and c.moderation_status='allowed'
   and (c.recruit_until is null or c.recruit_until>at_time)
   and (c.capacity is null or public.campaign_selected(c.id)<c.capacity)
   and (not(c.brief?'terms') or (public.valid_campaign_terms(c.brief->'terms')
     and (c.brief#>>'{terms,recruitment,start}')::timestamptz<=at_time
     and (c.brief#>>'{terms,recruitment,end}')::timestamptz>at_time))
   and not exists(select 1 from adme_ops.job_posts j where j.campaign_id=c.id
     and (j.expires_at is null or j.expires_at<=at_time)),false);
$$;
revoke all on function adme_ops.campaign_accepting_at(public.campaigns,timestamptz) from public,anon,authenticated,service_role;

create or replace function public.campaign_accepting(p_campaign uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select adme_ops.campaign_accepting_at(c,statement_timestamp())
   from public.campaigns c where c.id=p_campaign),false);
$$;

create function adme_ops.guard_application_window() returns trigger
language plpgsql security definer set search_path='' as $$
declare campaign public.campaigns;
begin
 if new.kind<>'application' then return new; end if;
 perform adme_privacy.enforce_actor();
 -- SHARE conflicts with publication/selection updates; clock is read after waiting.
 select * into campaign from public.campaigns where id=new.campaign_id for share;
 if not found or not adme_ops.campaign_accepting_at(campaign,clock_timestamp()) then
   raise exception 'RECRUITMENT_NOT_OPEN' using errcode='PT409';
 end if;
 return new;
end $$;
revoke all on function adme_ops.guard_application_window() from public,anon,authenticated,service_role;
create trigger campaign_application_window before insert on public.proposals
for each row execute function adme_ops.guard_application_window();

-- Add safe recruitment metadata while preserving URL, brief and visibility contracts.
create or replace function adme_ops.marketplace_board(p_id uuid default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(result)),'[]') from (
 select c.id,c.brief,case when c.status='published' and j.expires_at<=now() then 'closed' else c.status end as status,
   j.expires_at,c.recruit_until,c.capacity,public.campaign_selected(c.id) as selected_count,
   adme_ops.campaign_accepting_at(c,statement_timestamp()) as accepting,
   coalesce(c.owner_id=auth.uid(),false) as owned,
   exists(select 1 from public.proposals p where p.campaign_id=c.id
     and p.creator_user_id=auth.uid() and p.kind='application') as applied
 from adme_ops.job_posts j join public.campaigns c on c.id=j.campaign_id
 where (p_id is null or c.id=p_id) and
   (c.owner_id=auth.uid() or (c.status='published' and j.expires_at>now()))
 order by c.created_at desc,c.id limit 60
 ) result;
$$;
